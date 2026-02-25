import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User, IUser } from '../models/User.js';
import { logEvent } from '../services/auditService.js';
import { emailService } from '../services/emailService.js';
import logger from '../utils/logger.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(async (_req, res) => {
    const users = await User.find({ role: 'user' })
        .select('displayName email photo status accessExpiresAt isTempAccess createdAt')
        .sort({ createdAt: -1 })
        .lean();
    res.json(users);
}));

router.patch('/:userId/approve', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;
    const { durationDays } = req.body;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.email === 'crownsolution.noc@gmail.com') {
        res.status(403).json({ error: 'Cannot modify admin account' });
        return;
    }

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

    emailService.getSettings().then(async (emailSettings) => {
        if (emailSettings.enabled && emailSettings.notifyUserApproved) {
            await emailService.enqueue(
                'USER_APPROVED',
                [user.email],
                '✅ Access Approved - SSH Manager',
                'user-approved',
                {
                    userName: user.displayName,
                    expiresAt: user.accessExpiresAt ? new Date(user.accessExpiresAt).toLocaleDateString() : null,
                    loginUrl: process.env.FRONTEND_URL || '/',
                }
            ).catch(err => logger.error('Failed to enqueue approval email:', err));
        }
    });

    res.json({ success: true, user });
}));

// Reject - soft rejection, user can be approved later
router.patch('/:userId/reject', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.email === 'crownsolution.noc@gmail.com') {
        res.status(403).json({ error: 'Cannot modify admin account' });
        return;
    }

    user.status = 'rejected';
    user.accessExpiresAt = undefined;
    user.isTempAccess = false;
    await user.save();

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_REJECTED',
        target: user.email,
    });

    res.json({ success: true, user });
}));

// Block - permanent block, user cannot login
router.patch('/:userId/block', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.email === 'crownsolution.noc@gmail.com') {
        res.status(403).json({ error: 'Cannot modify admin account' });
        return;
    }

    user.status = 'blocked';
    user.accessExpiresAt = undefined;
    user.isTempAccess = false;
    await user.save();

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_BLOCKED',
        target: user.email,
    });

    res.json({ success: true, user });
}));

// Unblock - move back to pending
router.patch('/:userId/unblock', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.email === 'crownsolution.noc@gmail.com') {
        res.status(403).json({ error: 'Cannot modify admin account' });
        return;
    }

    user.status = 'pending';
    await user.save();

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_UNBLOCKED',
        target: user.email,
    });

    res.json({ success: true, user });
}));

// Revoke - remove access, move back to pending
router.patch('/:userId/revoke', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.email === 'crownsolution.noc@gmail.com') {
        res.status(403).json({ error: 'Cannot modify admin account' });
        return;
    }

    user.status = 'pending';
    user.accessExpiresAt = undefined;
    user.isTempAccess = false;
    await user.save();

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'USER_REVOKED',
        target: user.email,
    });

    res.json({ success: true, user });
}));

export default router;
