import { Router } from 'express';
import { vmService } from '../services/vmService.js';
import { validate } from '../middleware/validate.js';
import { createVMSchema, updateVMSchema } from '../schemas/vmSchema.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { IUser } from '../models/User.js';
import { logEvent } from '../services/auditService.js';

const router = Router();

// All VM routes require authentication
router.use(requireAuth);

// Helper to filter VM data based on user role
const filterVMData = (vm: any, user: IUser) => {
    if (user.role === 'admin') {
        return vm;
    }
    // Regular users only see name and id
    return {
        id: vm.id,
        name: vm.name,
        environmentId: vm.environmentId,
        isPinned: vm.isPinned
    };
};

// GET: Any authenticated user can list VMs
router.get('/', asyncHandler(async (req, res) => {
  const environmentId = req.query.environmentId as string | undefined;
  const search = req.query.search as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const user = req.user as IUser;

  const result = await vmService.getAll(environmentId, search, page, limit);
  const filteredData = result.data.map(vm => filterVMData(vm, user));
  res.json({ data: filteredData, total: result.total });
}));

// POST: Admin only
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

// PUT: Admin only
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

// DELETE: Admin only
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

export default router;
