import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

export type PasswordOperationType = 'manual' | 'auto';

export interface IPasswordHistory extends Document {
  vmId: string;
  vmName: string;
  vmIp: string;
  vmUsername: string;
  newPassword: string;
  oldPassword?: string;
  operationType: PasswordOperationType;
  changedBy: string;
  changedById: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}

const PasswordHistorySchema: Schema = new Schema({
  vmId: { type: String, required: true, index: true },
  vmName: { type: String, required: true },
  vmIp: { type: String, required: true },
  vmUsername: { type: String, required: true },
  newPassword: {
    type: String,
    required: true,
    get: (v: string) => (v && v.includes(':') ? decrypt(v) : v),
    set: (v: string) => (v && !v.includes(':') ? encrypt(v) : v),
  },
  oldPassword: {
    type: String,
    get: (v: string) => (v && v.includes(':') ? decrypt(v) : v),
    set: (v: string) => (v && !v.includes(':') ? encrypt(v) : v),
  },
  operationType: { type: String, enum: ['manual', 'auto'], required: true },
  changedBy: { type: String, required: true },
  changedById: { type: String, required: true },
  success: { type: Boolean, default: true },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now, index: true },
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

PasswordHistorySchema.index({ createdAt: -1 });
PasswordHistorySchema.index({ vmId: 1, createdAt: -1 });
PasswordHistorySchema.index({ changedById: 1, createdAt: -1 });

export const PasswordHistoryModel = mongoose.model<IPasswordHistory>('PasswordHistory', PasswordHistorySchema);
