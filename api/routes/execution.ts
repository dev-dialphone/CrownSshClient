import { Router } from 'express';
import { executionQueue } from '../queues/executionQueue.js';
import { validate } from '../middleware/validate.js';
import { executeCommandSchema } from '../schemas/executionSchema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { IUser } from '../models/User.js';
import { logEvent } from '../services/auditService.js';
import { vmService } from '../services/vmService.js';
import { Environment } from '../models/Environment.js';
import { getDefaultCommand } from '../config/defaultEnvironments.js';
import logger from '../utils/logger.js';
import { AuditAction } from '../models/AuditLog.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate(executeCommandSchema), asyncHandler(async (req, res) => {
  const { vmIds, command: customCommand } = req.body;
  const user = req.user as IUser;

  const environments = await Environment.find();
  const envCommandMap = new Map<string, string>();
  for (const env of environments) {
    envCommandMap.set((env as any)._id.toString(), env.command || getDefaultCommand(env.name));
  }

  const jobs: { name: string; data: { vmId: string; command: string; actorId: string; actorEmail: string; actorRole: string } }[] = [];
  const logs: { actorId: string; actorEmail: string; actorRole: string; action: AuditAction; target: string; metadata: Record<string, unknown> }[] = [];

  for (const vmId of vmIds) {
    const vm = await vmService.getById(vmId);
    if (!vm) {
      logger.warn(`VM not found: ${vmId}`);
      continue;
    }

    const command = customCommand || envCommandMap.get(vm.environmentId || '') || '';

    if (!command) {
      logger.warn(`No command found for VM ${vm.name} (env: ${vm.environmentId})`);
      continue;
    }

    jobs.push({
      name: 'execute-command',
      data: {
        vmId,
        command,
        actorId: (user as any)._id?.toString() || (user as any).id,
        actorEmail: user.email,
        actorRole: user.role
      },
    });

    logs.push({
      actorId: (user as any)._id?.toString() || (user as any).id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'COMMAND_EXECUTED',
      target: vm.name || 'VM',
      metadata: { command, vmId: vm.id, environmentId: vm.environmentId }
    });
  }

  if (jobs.length === 0) {
    res.status(400).json({ error: 'No valid VMs to execute commands on' });
    return;
  }

  await executionQueue.addBulk(jobs);
  await Promise.all(logs.map(log => logEvent(log)));

  res.json({ message: 'Execution started', jobCount: jobs.length });
}));

export default router;
