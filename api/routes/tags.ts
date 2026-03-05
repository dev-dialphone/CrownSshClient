import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { IUser, UserPermission } from '../models/User.js';
import { VMModel } from '../models/VM.js';
import { TagRequestModel, ITagRequest } from '../models/TagRequest.js';
import { logEvent } from '../services/auditService.js';
import { addTagSchema, requestTagChangeSchema, reviewTagRequestSchema, removeTagSchema } from '../schemas/tagSchema.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(requireAuth);

const hasExecPermission = (user: IUser): boolean => {
  if (user.role === 'admin') return true;
  const permissions = user.permissions || ['env', 'exec', 'monitor'] as UserPermission[];
  return permissions.includes('exec');
};

router.get('/vm/:vmId', asyncHandler(async (req, res) => {
  const { vmId } = req.params;
  const vm = await VMModel.findById(vmId).select('tags name ip');
  
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  res.json({ tags: vm.tags || [], vmName: vm.name, vmIp: vm.ip });
}));

router.post('/vm/:vmId/add', validate(addTagSchema), asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const { vmId } = req.params;
  const { tagText } = req.body;
  
  if (!hasExecPermission(user)) {
    res.status(403).json({ error: 'You need execution permission to add tags' });
    return;
  }
  
  const vm = await VMModel.findById(vmId);
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  if (!vm.tags) {
    vm.tags = [];
  }
  
  const userId = (user as any)._id?.toString() || (user as any).id;
  const existingUserTag = vm.tags.find(tag => tag.addedBy === userId);
  
  if (existingUserTag) {
    res.status(400).json({ 
      error: 'You have already tagged this VM. Please request a tag change instead.',
      hasExistingTag: true,
      existingTag: existingUserTag
    });
    return;
  }
  
  vm.tags.push({
    text: tagText,
    addedBy: userId,
    addedByEmail: user.email,
    addedAt: new Date()
  });
  
  await vm.save();
  
  await logEvent({
    actorId: userId,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'VM_TAG_ADDED',
    target: vm.name,
    metadata: { vmId: vm.id, tagText }
  });
  
  res.json({ success: true, tags: vm.tags });
}));

router.post('/vm/:vmId/request-change', validate(requestTagChangeSchema), asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const { vmId } = req.params;
  const { tagText, requestType, existingTagIndex } = req.body;
  
  if (!hasExecPermission(user)) {
    res.status(403).json({ error: 'You need execution permission to request tag changes' });
    return;
  }
  
  const vm = await VMModel.findById(vmId);
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  const userId = (user as any)._id?.toString() || (user as any).id;
  
  const existingPendingRequest = await TagRequestModel.findOne({
    vmId,
    requestedBy: userId,
    status: 'pending'
  });
  
  if (existingPendingRequest) {
    res.status(400).json({ 
      error: 'You already have a pending tag change request for this VM',
      pendingRequest: existingPendingRequest
    });
    return;
  }
  
  const tagRequest = new TagRequestModel({
    vmId,
    vmName: vm.name,
    vmIp: vm.ip,
    requestedBy: userId,
    requestedByEmail: user.email,
    tagText,
    requestType,
    status: 'pending'
  });
  
  await tagRequest.save();
  
  await logEvent({
    actorId: userId,
    actorEmail: user.email,
    actorRole: user.role,
    action: 'VM_TAG_CHANGE_REQUESTED',
    target: vm.name,
    metadata: { vmId: vm.id, tagText, requestType, requestId: tagRequest.id }
  });
  
  res.json({ 
    success: true, 
    message: 'Tag change request submitted. An admin will review it.',
    request: tagRequest 
  });
}));

router.get('/requests/pending', requireRole('admin'), asyncHandler(async (req, res) => {
  const requests = await TagRequestModel.find({ status: 'pending' })
    .sort({ createdAt: -1 })
    .lean();
  
  res.json(requests);
}));

router.get('/requests/all', requireRole('admin'), asyncHandler(async (req, res) => {
  const { status, vmId, requestedBy } = req.query;
  
  const filter: any = {};
  if (status) filter.status = status;
  if (vmId) filter.vmId = vmId;
  if (requestedBy) filter.requestedBy = requestedBy;
  
  const requests = await TagRequestModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  
  res.json(requests);
}));

router.patch('/requests/:requestId/review', requireRole('admin'), validate(reviewTagRequestSchema), asyncHandler(async (req, res) => {
  const admin = req.user as IUser;
  const { requestId } = req.params;
  const { approved } = req.body;
  
  const tagRequest = await TagRequestModel.findById(requestId);
  if (!tagRequest) {
    res.status(404).json({ error: 'Tag request not found' });
    return;
  }
  
  if (tagRequest.status !== 'pending') {
    res.status(400).json({ error: 'This request has already been reviewed' });
    return;
  }
  
  const adminId = (admin as any)._id?.toString() || (admin as any).id;
  
  tagRequest.status = approved ? 'approved' : 'rejected';
  tagRequest.reviewedBy = adminId;
  tagRequest.reviewedByEmail = admin.email;
  tagRequest.reviewedAt = new Date();
  await tagRequest.save();
  
  if (approved) {
    const vm = await VMModel.findById(tagRequest.vmId);
    if (!vm) {
      res.status(404).json({ error: 'VM not found' });
      return;
    }
    
    if (!vm.tags) {
      vm.tags = [];
    }
    
    if (tagRequest.requestType === 'add') {
      vm.tags.push({
        text: tagRequest.tagText,
        addedBy: tagRequest.requestedBy,
        addedByEmail: tagRequest.requestedByEmail,
        addedAt: new Date()
      });
    } else if (tagRequest.requestType === 'remove') {
      const tagIndex = vm.tags.findIndex(
        t => t.addedBy === tagRequest.requestedBy && t.text === tagRequest.tagText
      );
      if (tagIndex !== -1) {
        vm.tags.splice(tagIndex, 1);
      }
    }
    
    await vm.save();
    
    await logEvent({
      actorId: adminId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'VM_TAG_REQUEST_APPROVED',
      target: vm.name,
      metadata: { 
        vmId: vm.id, 
        tagText: tagRequest.tagText, 
        requestType: tagRequest.requestType,
        originalRequester: tagRequest.requestedByEmail
      }
    });
  } else {
    await logEvent({
      actorId: adminId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'VM_TAG_REQUEST_REJECTED',
      target: tagRequest.vmName,
      metadata: { 
        vmId: tagRequest.vmId, 
        tagText: tagRequest.tagText, 
        requestType: tagRequest.requestType,
        originalRequester: tagRequest.requestedByEmail
      }
    });
  }
  
  res.json({ success: true, request: tagRequest });
}));

router.delete('/vm/:vmId/tag/:tagIndex', requireRole('admin'), asyncHandler(async (req, res) => {
  const admin = req.user as IUser;
  const { vmId, tagIndex } = req.params;
  
  const vm = await VMModel.findById(vmId);
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  const index = parseInt(tagIndex);
  if (!vm.tags || index < 0 || index >= vm.tags.length) {
    res.status(400).json({ error: 'Invalid tag index' });
    return;
  }
  
  const removedTag = vm.tags[index];
  vm.tags.splice(index, 1);
  await vm.save();
  
  const adminId = (admin as any)._id?.toString() || (admin as any).id;
  
  await logEvent({
    actorId: adminId,
    actorEmail: admin.email,
    actorRole: admin.role,
    action: 'VM_TAG_REMOVED',
    target: vm.name,
    metadata: { vmId: vm.id, removedTag }
  });
  
  res.json({ success: true, tags: vm.tags });
}));

router.get('/my-requests', asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const userId = (user as any)._id?.toString() || (user as any).id;
  
  const requests = await TagRequestModel.find({ requestedBy: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  
  res.json(requests);
}));

router.get('/vm/:vmId/my-tag', asyncHandler(async (req, res) => {
  const user = req.user as IUser;
  const { vmId } = req.params;
  const userId = (user as any)._id?.toString() || (user as any).id;
  
  const vm = await VMModel.findById(vmId).select('tags');
  if (!vm) {
    res.status(404).json({ error: 'VM not found' });
    return;
  }
  
  const myTag = vm.tags?.find(tag => tag.addedBy === userId);
  
  const pendingRequest = await TagRequestModel.findOne({
    vmId,
    requestedBy: userId,
    status: 'pending'
  });
  
  res.json({ 
    myTag: myTag || null, 
    hasPendingRequest: !!pendingRequest,
    pendingRequest: pendingRequest || null
  });
}));

export default router;
