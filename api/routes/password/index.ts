import { Router } from 'express';
import { vmService } from '../../services/vmService.js';
import { sshService } from '../../services/sshService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../../middleware/requireAuth.js';
import { IUser } from '../../models/User.js';
import { logEvent } from '../../services/auditService.js';
import { 
  acquirePasswordLock,
  releasePasswordLock,
} from '../../middleware/passwordRateLimit.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/history', asyncHandler(async (req, res) => {
  const vmId = req.query.vmId as string | undefined;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  const format = req.query.format as 'json' | 'csv' || 'json';
  
  const result = await vmService.getPasswordHistory({
    vmId,
    startDate,
    endDate,
    limit,
    offset,
  });
  
  if (format === 'csv') {
    const csv = [
      'VM Name,IP Address,Username,New Password,Operation,Changed By,Success,Timestamp',
      ...result.data.map(entry => 
        `"${entry.vmName}","${entry.vmIp}","${entry.vmUsername}","${entry.newPassword}","${entry.operationType}","${entry.changedBy}","${entry.success}","${entry.createdAt.toISOString()}"`
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="password-history.csv"');
    res.send(csv);
  } else {
    res.json(result);
  }
}));

router.get('/export', asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
  const format = (req.query.format as 'csv' | 'json') || 'csv';
  
  const result = await vmService.getPasswordHistory({
    startDate,
    endDate,
    limit: 10000,
  });
  
  await logEvent({
    actorId: (user as any)._id?.toString() || (user as any).id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'PASSWORD_HISTORY_EXPORTED',
    target: 'Password History',
    metadata: { format, recordCount: result.total }
  });
  
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="password-history.json"');
    res.json(result.data);
  } else {
    const csv = [
      'VM Name,IP Address,Username,New Password,Operation,Changed By,Success,Error Message,Timestamp',
      ...result.data.map(entry => 
        `"${entry.vmName}","${entry.vmIp}","${entry.vmUsername}","${entry.newPassword}","${entry.operationType}","${entry.changedBy}","${entry.success}","${entry.errorMessage || ''}","${entry.createdAt.toISOString()}"`
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="password-history.csv"');
    res.send(csv);
  }
}));

router.post('/bulk-update', asyncHandler(async (req, res) => {
  const { newPassword, testConnection = true, vmIds } = req.body;
  const user = req.user as IUser;
  const adminId = (user as any)._id?.toString() || (user as any).id;

  if (!newPassword || newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  let targetVmIds: string[] = vmIds;
  if (!targetVmIds || targetVmIds.length === 0) {
    const allVMsResult = await vmService.getAll();
    targetVmIds = allVMsResult.data.map(v => v.id);
  }

  if (targetVmIds.length === 0) {
    res.status(400).json({ error: 'No VMs found to update' });
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
    target: 'Bulk Update',
    metadata: { 
      totalVMs: targetVmIds.length, 
      successCount, 
      failCount,
      method: 'bulk_manual' 
    }
  });

  res.json({
    success: true,
    newPassword,
    total: results.length,
    successCount,
    failCount,
    results,
  });
}));

export default router;
