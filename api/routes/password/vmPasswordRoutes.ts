import { Router } from 'express';
import { vmService } from '../../services/vmService.js';
import { sshService } from '../../services/sshService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../../middleware/requireAuth.js';
import { IUser } from '../../models/User.js';
import { logEvent } from '../../services/auditService.js';
import { 
  manualPasswordRateLimit, 
  autoPasswordRateLimit, 
  testConnectionRateLimit,
  passwordLockMiddleware,
  acquirePasswordLock,
  releasePasswordLock,
  getPasswordRateLimitInfo,
} from '../../middleware/passwordRateLimit.js';
import logger from '../../utils/logger.js';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/:id/history', asyncHandler(async (req, res) => {
  const vm = await vmService.getById(req.params.id);
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  const result = await vmService.getPasswordHistory({
    vmId: req.params.id,
    limit: 20,
  });
  
  res.json(result.data);
}));

router.post('/:id/restore', asyncHandler(async (req, res) => {
  const { historyId } = req.body;
  const user = req.user as IUser;
  const adminId = (user as any)._id?.toString() || (user as any).id;
  
  if (!historyId) {
    res.status(400).json({ error: 'History ID is required' });
    return;
  }
  
  const vm = await vmService.getById(req.params.id);
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  const PasswordHistoryModel = (await import('../../models/PasswordHistory.js')).PasswordHistoryModel;
  const historyEntry = await PasswordHistoryModel.findById(historyId);
  
  if (!historyEntry || historyEntry.vmId !== vm.id) {
    res.status(404).json({ error: 'History entry not found' });
    return;
  }
  
  if (!historyEntry.oldPassword) {
    res.status(400).json({ error: 'No old password available in this history entry' });
    return;
  }
  
  const restorePassword = historyEntry.oldPassword;
  const currentPassword = vm.password;
  
  const lockAcquired = await acquirePasswordLock(vm.id);
  if (!lockAcquired) {
    res.status(423).json({ error: 'OPERATION_IN_PROGRESS', message: 'Another password operation is in progress' });
    return;
  }
  
  try {
    const changeResult = await sshService.changePassword(vm, restorePassword);
    if (!changeResult.success) {
      await vmService.addPasswordHistory({
        vmId: vm.id,
        vmName: vm.name,
        vmIp: vm.ip,
        vmUsername: vm.username,
        newPassword: restorePassword,
        oldPassword: currentPassword,
        operationType: 'manual',
        changedBy: user.email,
        changedById: adminId,
        success: false,
        errorMessage: `Restore failed: ${changeResult.message}`,
      });
      await releasePasswordLock(vm.id);
      res.status(400).json({ 
        error: 'Failed to restore password on VM', 
        message: changeResult.message 
      });
      return;
    }
    
    await vmService.updatePassword(vm.id, restorePassword);
    
    await vmService.addPasswordHistory({
      vmId: vm.id,
      vmName: vm.name,
      vmIp: vm.ip,
      vmUsername: vm.username,
      newPassword: restorePassword,
      oldPassword: currentPassword,
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
      metadata: { vmId: vm.id, method: 'restore', historyId }
    });
    
    res.json({ 
      success: true, 
      message: 'Password restored successfully',
      restoredPassword: restorePassword 
    });
  } catch (error) {
    logger.error('Password restore error:', error);
    res.status(500).json({ error: 'Failed to restore password', message: (error as Error).message });
  } finally {
    await releasePasswordLock(vm.id);
  }
}));

router.post('/:id/test', 
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

router.post('/:id/sync', asyncHandler(async (req, res) => {
  const { actualPassword } = req.body;
  const user = req.user as IUser;
  const adminId = (user as any)._id?.toString() || (user as any).id;
  
  if (!actualPassword) {
    res.status(400).json({ error: 'Actual password is required' });
    return;
  }
  
  const vm = await vmService.getById(req.params.id);
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  const testVM = { ...vm, password: actualPassword };
  const connTest = await sshService.testConnection(testVM);
  
  if (!connTest.success) {
    res.status(400).json({ 
      error: 'Connection failed with provided password', 
      message: connTest.message 
    });
    return;
  }
  
  const oldDbPassword = vm.password;
  await vmService.updatePassword(vm.id, actualPassword);
  
  await vmService.addPasswordHistory({
    vmId: vm.id,
    vmName: vm.name,
    vmIp: vm.ip,
    vmUsername: vm.username,
    newPassword: actualPassword,
    oldPassword: oldDbPassword,
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
    metadata: { vmId: vm.id, method: 'sync' }
  });
  
  res.json({ 
    success: true, 
    message: 'Database synced with actual VM password' 
  });
}));

router.get('/:id/rate-limit', asyncHandler(async (req, res) => {
  const vmId = req.params.id;
  const user = req.user as IUser;
  const adminId = (user as any)._id?.toString() || (user as any).id;
  const isAdmin = user.role === 'admin';
  
  const [manualInfo, autoInfo] = await Promise.all([
    getPasswordRateLimitInfo(vmId, adminId, 'manual', isAdmin),
    getPasswordRateLimitInfo(vmId, adminId, 'auto', isAdmin),
  ]);
  
  res.json({ manual: manualInfo, auto: autoInfo });
}));

router.put('/:id/manual',
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
      
      res.json({ success: true, message: 'Password updated successfully.' });
    } catch (error) {
      logger.error('Manual password update error:', error);
      res.status(500).json({ error: 'Failed to update password', message: (error as Error).message });
    } finally {
      await releasePasswordLock(vm.id);
    }
  })
);

router.post('/:id/auto-reset',
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
      if (!testResult.user) {
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
      
      if (!testResult.root) {
        logger.warn(`Root password verification failed for VM ${vm.id}, but user password verified successfully.`);
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

export default router;
