import mongoose, { Schema, Document } from 'mongoose';

export type AuditAction =
    | 'LOGIN'
    | 'LOGOUT'
    | 'VM_CREATED'
    | 'VM_UPDATED'
    | 'VM_DELETED'
    | 'VM_PINNED'
    | 'COMMAND_EXECUTED'
    | 'ENV_CREATED'
    | 'ENV_UPDATED'
    | 'ENV_DELETED'
    | 'USER_APPROVED'
    | 'USER_REJECTED'
    | 'USER_REVOKED'
    | 'SETTING_UPDATED';

export interface IAuditLog extends Document {
    actorId: string;         // User._id
    actorEmail: string;      // For display without lookup
    actorRole: string;       // 'admin' | 'user'
    action: AuditAction;
    target?: string;         // Name of VM, environment, or user affected
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

const AuditLogSchema: Schema = new Schema({
    actorId: { type: String, required: true },
    actorEmail: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    target: { type: String },
    metadata: { type: Schema.Types.Mixed },
}, {
    timestamps: true,
});

// Index for efficient range queries and filtering by actor
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
