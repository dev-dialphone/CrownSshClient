import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { IUser } from '../models/User.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for browser subscription
 */
router.get('/vapid-public-key', (_req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY;
    if (!key) {
        res.status(503).json({ error: 'Web Push not configured on this server.' });
        return;
    }
    res.json({ key });
});

/**
 * POST /api/push/subscribe
 * Saves a browser push subscription for this admin user
 */
router.post('/subscribe', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const { subscription } = req.body;

    if (!subscription?.endpoint) {
        res.status(400).json({ error: 'Invalid subscription object.' });
        return;
    }

    await PushSubscription.findOneAndUpdate(
        { endpoint: subscription.endpoint },
        { userId: actor._id.toString(), subscription, endpoint: subscription.endpoint },
        { upsert: true, new: true }
    );

    res.json({ success: true });
}));

/**
 * DELETE /api/push/unsubscribe
 * Removes a push subscription by endpoint
 */
router.delete('/unsubscribe', asyncHandler(async (req, res) => {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
}));

export default router;
