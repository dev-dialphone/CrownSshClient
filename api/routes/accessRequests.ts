import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User, IUser } from '../models/User.js';
import { logEvent } from '../services/auditService.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * GET /api/access-requests
 * Returns all users with their status, for the admin access control panel
 */
router.get('/', asyncHandler(async (_req, res) => {
    const users = await User.find({ role: 'user' })
        .select('displayName email photo status accessExpiresAt isTempAccess createdAt')
        .sort({ createdAt: -1 })
        .lean();
    res.json(users);
}));

/**
 * PATCH /api/access-requests/:userId/approve
 * Body: { durationDays: number | null }  (null = permanent)
 */
router.patch('/:userId/approve', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;
    const { durationDays } = req.body;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    user.status = 'active';
    if (durationDays && durationDays > 0) {
        user.accessExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        user.isTempAccess = true;
    } else {
        user.accessExpiresAt = undefined;
        user.isTempAccess = false;
    }
    await user.save();

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_APPROVED',
        target: user.email,
        metadata: { durationDays: durationDays ?? 'permanent' },
    });

    res.json({ success: true, user });
}));

/**
 * PATCH /api/access-requests/:userId/reject
 */
router.patch('/:userId/reject', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(userId, { status: 'rejected' }, { new: true });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_REJECTED',
        target: user.email,
    });

    res.json({ success: true });
}));

/**
 * PATCH /api/access-requests/:userId/revoke
 */
router.patch('/:userId/revoke', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;

    const user = await User.findByIdAndUpdate(userId, {
        status: 'pending',
        accessExpiresAt: null,
        isTempAccess: false,
    }, { new: true });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_REVOKED',
        target: user.email,
    });

    res.json({ success: true });
}));

export default router;
