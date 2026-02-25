import mongoose, { Schema, Document } from 'mongoose';

export type EmailType = 
    | 'VM_DOWN' 
    | 'VM_RECOVERED' 
    | 'USER_REQUEST' 
    | 'USER_APPROVED' 
    | 'USER_REJECTED' 
    | 'TEST';

export type EmailStatus = 'pending' | 'sent' | 'failed';

export interface IEmailLog extends Document {
    type: EmailType;
    to: string[];
    subject: string;
    status: EmailStatus;
    error?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

const EmailLogSchema: Schema = new Schema({
    type: { 
        type: String, 
        required: true,
        enum: ['VM_DOWN', 'VM_RECOVERED', 'USER_REQUEST', 'USER_APPROVED', 'USER_REJECTED', 'TEST']
    },
    to: { 
        type: [String], 
        required: true 
    },
    subject: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        required: true,
        enum: ['pending', 'sent', 'failed'],
        default: 'pending'
    },
    error: { 
        type: String 
    },
    metadata: { 
        type: Schema.Types.Mixed 
    },
}, {
    timestamps: true,
});

EmailLogSchema.index({ createdAt: -1 });
EmailLogSchema.index({ status: 1 });
EmailLogSchema.index({ type: 1 });

export const EmailLog = mongoose.model<IEmailLog>('EmailLog', EmailLogSchema);
