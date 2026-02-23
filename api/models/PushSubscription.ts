import mongoose, { Schema, Document } from 'mongoose';

/**
 * Stores Web Push API subscriptions from Admin browsers.
 * Each subscription is a unique browser endpoint for push notifications.
 */
export interface IPushSubscription extends Document {
    userId: string;
    subscription: object; // PushSubscription object from the browser
}

const PushSubscriptionSchema: Schema = new Schema({
    userId: { type: String, required: true },
    subscription: { type: Schema.Types.Mixed, required: true },
    endpoint: { type: String, unique: true, sparse: true }, // For deduplication
}, {
    timestamps: true,
});

export const PushSubscription = mongoose.model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);
