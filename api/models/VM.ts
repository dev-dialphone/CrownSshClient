import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

export interface VMTag {
  text: string;
  addedBy: string;
  addedByEmail: string;
  addedAt: Date;
}

export interface IVM extends Document {
  name: string;
  ip: string;
  username: string;
  password?: string;
  port: number;
  environmentId?: string;
  isPinned?: boolean;
  tags: VMTag[];
}

const VMSchema: Schema = new Schema({
  name: { type: String, required: true },
  ip: { type: String, required: true },
  username: { type: String, required: true },
  password: {
    type: String,
    get: (v: string | undefined) => (v ? decrypt(v) : v),
    set: (v: string | undefined) => (v ? encrypt(v) : v),
  },
  port: { type: Number, default: 22 },
  environmentId: { type: String, index: true },
  isPinned: { type: Boolean, default: false },
  tags: [{
    text: { type: String, required: true },
    addedBy: { type: String, required: true },
    addedByEmail: { type: String, required: true },
    addedAt: { type: Date, default: Date.now }
  }],
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Text index for search
VMSchema.index({ name: 'text', ip: 'text', username: 'text' });

export const VMModel = mongoose.model<IVM>('VM', VMSchema);
