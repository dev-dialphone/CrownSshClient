import webpush, { PushSubscription as WebPushSubscription } from 'web-push';
import { PushSubscription } from '../models/PushSubscription.js';
import logger from '../utils/logger.js';

export const initWebPush = () => {
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (!vapidPublic || !vapidPrivate) {
        logger.warn('VAPID keys not configured — Web Push notifications disabled. Generate with: npx web-push generate-vapid-keys');
        return;
    }

    webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
    logger.info('Web Push notifications initialized.');
};

export const sendPushToAll = async (title: string, body: string, data?: Record<string, unknown>) => {
    if (!process.env.VAPID_PUBLIC_KEY) return; // Silently skip if not configured

    const subscriptions = await PushSubscription.find().lean();
    const payload = JSON.stringify({ title, body, data });

    const results = await Promise.allSettled(
        subscriptions.map(s => webpush.sendNotification(s.subscription as WebPushSubscription, payload))
    );

    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            logger.warn(`Push failed for subscription ${subscriptions[i]._id}:`, r.reason?.message);
            // Remove expired subscriptions (HTTP 410 = unsubscribed)
            if (r.reason?.statusCode === 410) {
                PushSubscription.findByIdAndDelete(subscriptions[i]._id).catch(() => { });
            }
        }
    });
};
