import { Router } from 'express';
import { executionQueue } from '../queues/executionQueue.js';
import { validate } from '../middleware/validate.js';
import { executeCommandSchema } from '../schemas/executionSchema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { IUser } from '../models/User.js';
import { logEvent } from '../services/auditService.js';
import { vmService } from '../services/vmService.js';

const router = Router();

// Execution requires authentication but is open to all roles (users can Run)
router.use(requireAuth);

router.post('/', validate(executeCommandSchema), asyncHandler(async (req, res) => {
  const { vmIds, command } = req.body;
  const user = req.user as IUser;

  // Enqueue jobs with actor information
  const jobs = vmIds.map((vmId: string) => ({
    name: 'execute-command',
    data: { 
      vmId, 
      command,
      actorId: (user as any)._id?.toString() || (user as any).id,
      actorEmail: user.email,
      actorRole: user.role
    },
  }));

  await executionQueue.addBulk(jobs);

  // Log COMMAND_EXECUTED event for each VM
  const vms = await Promise.all(vmIds.map((id: string) => vmService.getById(id)));
  await Promise.all(vms.map(vm => {
    if (vm) {
      return logEvent({
        actorId: (user as any)._id?.toString() || (user as any).id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'COMMAND_EXECUTED',
        target: vm.name || 'VM',
        metadata: { command, vmId: vm.id }
      });
    }
  }));

  res.json({ message: 'Execution started', jobCount: jobs.length });
}));

export default router;
