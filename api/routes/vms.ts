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
  getPasswordRateLimitInfo,
} from '../middleware/passwordRateLimit.js';
import logger from '../utils/logger.js';

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

// ===== PASSWORD HISTORY ENDPOINTS (Static routes before /:id) =====

// Get password history
router.get('/passwords/history',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
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
  })
);

// Export password history (download)
router.get('/passwords/export',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
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
  })
);

// ===== PASSWORD MANAGEMENT ENDPOINTS =====

// Test connection to VM
router.post('/:id/password/test', 
  requireRole('admin'),
  testConnectionRateLimit,
  asyncHandler(async (req, res) => {
    const vm = await vmService.getById(req.params.id);
    if (!vm) {
      res.status(404).json({ error: 'VM not found' });
      return;
    }
    
    const result = await sshService.testConnection(vm);
    res.json(result);
  })
);

// Get rate limit info for a VM
router.get('/:id/password/rate-limit',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const vmId = req.params.id;
    const user = req.user as IUser;
    const adminId = (user as any)._id?.toString() || (user as any).id;
    const isAdmin = user.role === 'admin';
    
    const [manualInfo, autoInfo] = await Promise.all([
      getPasswordRateLimitInfo(vmId, adminId, 'manual', isAdmin),
      getPasswordRateLimitInfo(vmId, adminId, 'auto', isAdmin),
    ]);
    
    res.json({ manual: manualInfo, auto: autoInfo });
  })
);

// Manual password update
router.put('/:id/password/manual',
  requireRole('admin'),
  manualPasswordRateLimit,
  passwordLockMiddleware,
  asyncHandler(async (req, res) => {
    const { newPassword, testConnection = true } = req.body;
    const user = req.user as IUser;
    const adminId = (user as any)._id?.toString() || (user as any).id;
    
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    
    const vm = await vmService.getById(req.params.id);
    if (!vm) {
      res.status(404).json({ error: 'VM not found' });
      return;
    }
    
    const oldPassword = vm.password;
    
    const lockAcquired = await acquirePasswordLock(vm.id);
    if (!lockAcquired) {
      res.status(423).json({ error: 'OPERATION_IN_PROGRESS', message: 'Another password operation is in progress' });
      return;
    }
    
    try {
      if (testConnection) {
        const connTest = await sshService.testConnection(vm);
        if (!connTest.success) {
          await releasePasswordLock(vm.id);
          res.status(400).json({ error: 'Connection test failed', message: connTest.message });
          return;
        }
      }
      
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
        await releasePasswordLock(vm.id);
        res.status(400).json({ 
          error: 'Failed to change password on VM', 
          message: changeResult.message,
          requiresManual: changeResult.requiresManual 
        });
        return;
      }
      
      const updatedVM = await vmService.updatePassword(vm.id, newPassword);
      if (!updatedVM) {
        await releasePasswordLock(vm.id);
        res.status(500).json({ error: 'Password changed on VM but failed to update database. Please update manually.' });
        return;
      }
      
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
      
      await logEvent({
        actorId: adminId,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'VM_PASSWORD_CHANGED',
        target: vm.name || 'VM',
        metadata: { vmId: vm.id, method: 'manual' }
      });
      
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
      logger.error('Manual password update error:', error);
      res.status(500).json({ error: 'Failed to update password', message: (error as Error).message });
    } finally {
      await releasePasswordLock(vm.id);
    }
  })
);

// Automatic password reset
router.post('/:id/password/auto-reset',
  requireRole('admin'),
  autoPasswordRateLimit,
  passwordLockMiddleware,
  asyncHandler(async (req, res) => {
    const { length = 16, includeSpecialChars = true, testBeforeChange = true } = req.body;
    const user = req.user as IUser;
    const adminId = (user as any)._id?.toString() || (user as any).id;
    
    const vm = await vmService.getById(req.params.id);
    if (!vm) {
      res.status(404).json({ error: 'VM not found' });
      return;
    }
    
    const oldPassword = vm.password;
    
    const lockAcquired = await acquirePasswordLock(vm.id);
    if (!lockAcquired) {
      res.status(423).json({ error: 'OPERATION_IN_PROGRESS', message: 'Another password operation is in progress' });
      return;
    }
    
    try {
      if (testBeforeChange) {
        const connTest = await sshService.testConnection(vm);
        if (!connTest.success) {
          await releasePasswordLock(vm.id);
          res.status(400).json({ error: 'Connection test failed', message: connTest.message });
          return;
        }
      }
      
      const newPassword = sshService.generatePassword(length, includeSpecialChars);
      
      const changeResult = await sshService.changePassword(vm, newPassword);
      if (!changeResult.success) {
        await vmService.addPasswordHistory({
          vmId: vm.id,
          vmName: vm.name,
          vmIp: vm.ip,
          vmUsername: vm.username,
          newPassword,
          oldPassword,
          operationType: 'auto',
          changedBy: user.email,
          changedById: adminId,
          success: false,
          errorMessage: changeResult.message,
        });
        
        await releasePasswordLock(vm.id);
        res.status(400).json({ 
          error: 'Password change failed on VM', 
          message: changeResult.message,
          requiresManual: changeResult.requiresManual,
        });
        return;
      }
      
      const testResult = await sshService.testPassword(vm, newPassword);
      if (!testResult) {
        logger.error(`New password verification failed for VM ${vm.id}. Rolling back...`);
        if (oldPassword) {
          await sshService.changePassword({ ...vm, password: newPassword }, oldPassword);
        }
        
        await vmService.addPasswordHistory({
          vmId: vm.id,
          vmName: vm.name,
          vmIp: vm.ip,
          vmUsername: vm.username,
          newPassword,
          oldPassword,
          operationType: 'auto',
          changedBy: user.email,
          changedById: adminId,
          success: false,
          errorMessage: 'New password verification failed - rolled back',
        });
        
        await releasePasswordLock(vm.id);
        res.status(500).json({ 
          error: 'Password verification failed', 
          message: 'The new password could not be verified. The old password has been restored on the VM.' 
        });
        return;
      }
      
      await vmService.updatePassword(vm.id, newPassword);
      
      await vmService.addPasswordHistory({
        vmId: vm.id,
        vmName: vm.name,
        vmIp: vm.ip,
        vmUsername: vm.username,
        newPassword,
        oldPassword,
        operationType: 'auto',
        changedBy: user.email,
        changedById: adminId,
        success: true,
      });
      
      await logEvent({
        actorId: adminId,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'VM_PASSWORD_RESET',
        target: vm.name || 'VM',
        metadata: { vmId: vm.id, method: 'auto' }
      });
      
      res.json({ 
        success: true, 
        newPassword,
        message: 'Password reset successfully. Please save the new password securely.' 
      });
    } catch (error) {
      logger.error('Auto password reset error:', error);
      res.status(500).json({ error: 'Failed to reset password', message: (error as Error).message });
    } finally {
      await releasePasswordLock(vm.id);
    }
  })
);

// Bulk password update for all VMs
router.post('/passwords/bulk-update',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
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
  })
);

// Bulk password update for VMs in a specific environment
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
