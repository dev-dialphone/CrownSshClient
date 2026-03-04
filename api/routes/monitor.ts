import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { getMonitorMetricsSchema } from '../schemas/monitorSchema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { Environment } from '../models/Environment.js';
import { VMModel } from '../models/VM.js';
import { monitorService } from '../services/monitorService.js';
import { getDefaultMonitoringCommand } from '../config/defaultEnvironments.js';

const router = Router();

router.use(requireAuth);

router.post('/', requireRole('admin'), validate(getMonitorMetricsSchema), asyncHandler(async (req, res) => {
  const { environmentId } = req.body;

  const env = await Environment.findById(environmentId);
  if (!env) {
    res.status(404).json({ error: 'Environment not found' });
    return;
  }

  const monitoringCommand = env.monitoringCommand || getDefaultMonitoringCommand(env.name);

  if (!monitoringCommand) {
    res.json({
      configured: false,
      message: 'No monitoring command configured for this environment',
      environmentName: env.name,
    });
    return;
  }

  const vms = await VMModel.find({ environmentId });

  if (vms.length === 0) {
    res.json({
      configured: true,
      summary: {
        totalActive: 0,
        totalCapacity: 0,
        totalCPS: 0,
        maxCPS: 0,
        usagePercent: 0,
        healthyVMs: 0,
        errorVMs: 0,
        totalVMs: 0,
      },
      vms: {},
      lastUpdated: new Date(),
    });
    return;
  }

  const vmList = vms.map(v => {
    const obj = v.toObject();
    return {
      id: obj._id.toString(),
      name: obj.name,
      ip: obj.ip,
      username: obj.username,
      password: obj.password,
      port: obj.port,
      environmentId: obj.environmentId,
    };
  });

  const result = await monitorService.getMetricsForEnvironment(vmList, monitoringCommand);

  res.json({
    configured: true,
    ...result,
    environmentName: env.name,
  });
}));

export default router;
