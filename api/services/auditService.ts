import { AuditLog, AuditAction } from '../models/AuditLog.js';
import logger from '../utils/logger.js';

interface LogEventParams {
    actorId: string;
    actorEmail: string;
    actorRole: string;
    action: AuditAction;
    target?: string;
    metadata?: Record<string, unknown>;
}

export const logEvent = async (params: LogEventParams): Promise<void> => {
    try {
        await AuditLog.create(params);
    } catch (err) {
        // Non-fatal: log auditing errors but don't crash the request
        logger.error('Failed to write audit log:', err);
    }
};

export const getAuditLogs = async (page = 1, limit = 50) => {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
        AuditLog.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        AuditLog.countDocuments(),
    ]);
    return { logs, total };
};
