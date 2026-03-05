import mongoose, { Schema, Document } from 'mongoose';

export type TagRequestStatus = 'pending' | 'approved' | 'rejected';
export type TagRequestType = 'add' | 'remove';

export interface ITagRequest extends Document {
  vmId: string;
  vmName: string;
  vmIp: string;
  requestedBy: string;
  requestedByEmail: string;
  tagText: string;
  requestType: TagRequestType;
  status: TagRequestStatus;
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

const TagRequestSchema: Schema = new Schema({
  vmId: { type: String, required: true, index: true },
  vmName: { type: String, required: true },
  vmIp: { type: String, required: true },
  requestedBy: { type: String, required: true, index: true },
  requestedByEmail: { type: String, required: true },
  tagText: { type: String, required: true },
  requestType: { type: String, enum: ['add', 'remove'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: String },
  reviewedByEmail: { type: String },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now, index: true }
});

TagRequestSchema.index({ vmId: 1, requestedBy: 1, status: 1 });

export const TagRequestModel = mongoose.model<ITagRequest>('TagRequest', TagRequestSchema);
