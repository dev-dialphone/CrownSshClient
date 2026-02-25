import { Router } from 'express';
import { environmentService } from '../services/environmentService.js';
import { validate } from '../middleware/validate.js';
import { createEnvironmentSchema, updateEnvironmentSchema } from '../schemas/environmentSchema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { totpService } from '../services/totpService.js';
import { IUser } from '../models/User.js';
import { logEvent } from '../services/auditService.js';

const router = Router();

// All environment routes require authentication
router.use(requireAuth);

// GET: Any authenticated user can list environments
router.get('/', asyncHandler(async (req, res) => {
  const envs = await environmentService.getAll();
  res.json(envs);
}));

// POST: Admin only
router.post('/', requireRole('admin'), validate(createEnvironmentSchema), asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const { name } = req.body;
  const newEnv = await environmentService.add(name);
  
  await logEvent({
    actorId: (user as any)._id?.toString() || (user as any).id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'ENV_CREATED',
    target: newEnv.name,
    metadata: { envId: newEnv._id?.toString() }
  });
  
  res.json(newEnv);
}));

// PUT: Admin only
router.put('/:id', requireRole('admin'), validate(updateEnvironmentSchema), asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const updatedEnv = await environmentService.update(req.params.id, req.body);
  if (!updatedEnv) {
    res.status(404).json({ error: 'Environment not found' });
    return;
  }
  
  await logEvent({
    actorId: (user as any)._id?.toString() || (user as any).id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'ENV_UPDATED',
    target: updatedEnv.name,
    metadata: { envId: updatedEnv._id?.toString(), changes: req.body }
  });
  
  res.json(updatedEnv);
}));

// DELETE: Admin only + 2FA required
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const user = req.user as IUser;

  // Require 2FA verification for delete operations
  if (user.isTotpEnabled) {
    const { totpCode } = req.body;
    if (!totpCode) {
      res.status(400).json({ error: '2FA code is required to delete an environment.' });
      return;
    }

    const isValid = await totpService.verifyUserToken(user, totpCode);
    if (!isValid) {
      res.status(403).json({ error: 'Invalid 2FA code. Deletion cancelled.' });
      return;
    }
  }

  const env = await environmentService.getById(req.params.id);
  const success = await environmentService.delete(req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Environment not found' });
    return;
  }
  
  await logEvent({
    actorId: (user as any)._id?.toString() || (user as any).id,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'ENV_DELETED',
    target: env?.name || req.params.id,
    metadata: { envId: req.params.id }
  });
  
  res.json({ success: true });
}));

export default router;
