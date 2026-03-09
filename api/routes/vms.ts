import { Router, Response } from 'express';
import { vmService } from '../services/vmService.js';
import { validate } from '../middleware/validate.js';
import { createVMSchema, updateVMSchema } from '../schemas/vmSchema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { IUser } from '../models/User.js';
import { logEvent } from '../services/auditService.js';
import { sshService } from '../services/sshService.js';
import { 
  manualPasswordRateLimit, 
  autoPasswordRateLimit, 
  testConnectionRateLimit,
  passwordLockMiddleware,
  acquirePasswordLock,
  releasePasswordLock,
} from '../middleware/passwordRateLimit.js';
import logger from '../utils/logger.js';
import passwordRoutes from './password/index.js';
import vmPasswordRoutes from './password/vmPasswordRoutes.js';

const router = Router();

router.use(requireAuth);

const filterVMData = (vm: any, user: IUser) => {
    if (user.role === 'admin') {
        return vm;
    }
    return {
        id: vm.id,
        name: vm.name,
        environmentId: vm.environmentId,
        isPinned: vm.isPinned
    };
};

router.get('/', asyncHandler(async (req, res) => {
  const environmentId = req.query.environmentId as string | undefined;
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const grouped = req.query.grouped as string | undefined;
  const user = req.user as IUser;

  if (grouped === 'true') {
    const groups = await vmService.getAllGrouped();
    const filteredGroups = groups.map(group => ({
      ...group,
      vms: group.vms.map(vm => filterVMData(vm, user))
    }));
    res.json(filteredGroups);
    return;
  }

  const result = await vmService.getAll(environmentId, search, page, limit);
  const filteredData = result.data.map(vm => filterVMData(vm, user));
  res.json({ data: filteredData, total: result.total });
}));

router.post('/', requireRole('admin'), validate(createVMSchema), asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const newVM = await vmService.add(req.body);
  
  await logEvent({
    actorId: (user as any)._id?.toString() || (user as any).id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'VM_CREATED',
    target: newVM.name || 'VM',
    metadata: { vmId: newVM.id }
  });
  
  res.json(newVM);
}));

router.put('/:id', requireRole('admin'), validate(updateVMSchema), asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const updatedVM = await vmService.update(req.params.id, req.body);
  if (!updatedVM) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  await logEvent({
    actorId: (user as any)._id?.toString() || (user as any).id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'VM_UPDATED',
    target: updatedVM.name || 'VM',
    metadata: { vmId: updatedVM.id, changes: req.body }
  });
  
  res.json(updatedVM);
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const vm = await vmService.getById(req.params.id);
  const success = await vmService.delete(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  await logEvent({
    actorId: (user as any)._id?.toString() || (user as any).id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'VM_DELETED',
    target: vm?.name || 'VM',
    metadata: { vmId: req.params.id }
  });
  
  res.json({ success: true });
}));

router.use('/passwords', passwordRoutes);

router.use('/:id/password', vmPasswordRoutes);

router.post('/environments/:envId/passwords/bulk-update',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { envId } = req.params;
    const { newPassword, testConnection = true } = req.body;
    const user = req.user as IUser;
    const adminId = (user as any)._id?.toString() || (user as any).id;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const allVMsResult = await vmService.getAll(envId);
    const targetVmIds = allVMsResult.data.map(v => v.id);

    if (targetVmIds.length === 0) {
      res.status(400).json({ error: 'No VMs found in this environment' });
      return;
    }

    const results: Array<{
      vmId: string;
      vmName: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const vmId of targetVmIds) {
      const vm = await vmService.getById(vmId);
      if (!vm) {
        results.push({ vmId, vmName: 'Unknown', success: false, error: 'VM not found' });
        continue;
      }

      const lockAcquired = await acquirePasswordLock(vm.id);
      if (!lockAcquired) {
        results.push({ vmId: vm.id, vmName: vm.name, success: false, error: 'Operation in progress' });
        continue;
      }

      try {
        if (testConnection) {
          const connTest = await sshService.testConnection(vm);
          if (!connTest.success) {
            results.push({ vmId: vm.id, vmName: vm.name, success: false, error: connTest.message });
            await releasePasswordLock(vm.id);
            continue;
          }
        }

        const oldPassword = vm.password;
        
        const changeResult = await sshService.changePassword(vm, newPassword);
        if (!changeResult.success) {
          await vmService.addPasswordHistory({
            vmId: vm.id,
            vmName: vm.name,
            vmIp: vm.ip,
            vmUsername: vm.username,
            newPassword,
            oldPassword,
            operationType: 'manual',
            changedBy: user.email,
            changedById: adminId,
            success: false,
            errorMessage: changeResult.message,
          });
          results.push({ vmId: vm.id, vmName: vm.name, success: false, error: changeResult.message });
          await releasePasswordLock(vm.id);
          continue;
        }

        await vmService.updatePassword(vm.id, newPassword);

        await vmService.addPasswordHistory({
          vmId: vm.id,
          vmName: vm.name,
          vmIp: vm.ip,
          vmUsername: vm.username,
          newPassword,
          oldPassword,
          operationType: 'manual',
          changedBy: user.email,
          changedById: adminId,
          success: true,
        });

        results.push({ vmId: vm.id, vmName: vm.name, success: true });
      } catch (error) {
        results.push({ 
          vmId: vm.id, 
          vmName: vm.name, 
          success: false, 
          error: (error as Error).message 
        });
      } finally {
        await releasePasswordLock(vm.id);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    await logEvent({
      actorId: adminId,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'VM_PASSWORD_CHANGED',
      target: `Environment: ${envId}`,
      metadata: { 
        environmentId: envId,
        totalVMs: targetVmIds.length, 
        successCount, 
        failCount,
        method: 'bulk_environment' 
      }
    });

    res.json({
      success: true,
      newPassword,
      environmentId: envId,
      total: results.length,
      successCount,
      failCount,
      results,
    });
  })
);

export default router;
