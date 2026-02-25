import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Setting } from '../models/Setting.js';
import { logEvent } from '../services/auditService.js';
import { IUser } from '../models/User.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/settings
 * Returns all current platform settings (admin only)
 */
router.get('/', requireRole('admin'), asyncHandler(async (req, res) => {
    const settings = await Setting.find().lean();
    const map = Object.fromEntries(settings.map(s => [s.key, s.value]));

    // Include defaults for missing keys
    res.json({
        accessRequestsRequired: false,
        ...map,
    });
}));

/**
 * PATCH /api/settings/:key
 * Updates a single setting value (admin only)
 */
router.patch('/:key', requireRole('admin'), asyncHandler(async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const actor = req.user as IUser;

    const allowed = ['accessRequestsRequired', 'requiredPin'];
    if (!allowed.includes(key)) {
        res.status(400).json({ error: `Unknown setting: ${key}` });
        return;
    }

    await Setting.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
    );

    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SETTING_UPDATED',
        target: key,
        metadata: { value },
    });

    res.json({ key, value });
}));

export default router;
