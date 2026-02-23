import mongoose, { Schema, Document } from 'mongoose';

/**
 * Global platform settings stored in MongoDB.
 * Key-value configuration for toggleable features.
 */
export interface ISetting extends Document {
    key: string;
    value: boolean | string | number;
}

const SettingSchema: Schema = new Schema({
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
}, {
    timestamps: true,
});

export const Setting = mongoose.model<ISetting>('Setting', SettingSchema);

// ─── Default keys ──────────────────────────────────────────────────────────
// 'accessRequestsRequired' (boolean) — when true, new users start as 'pending'
//   and must be approved by an Admin before gaining access.
