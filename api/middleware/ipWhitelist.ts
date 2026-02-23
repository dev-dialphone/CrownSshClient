import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import { IUser } from '../models/User.js';

/**
 * Role-Aware IP Whitelist Middleware
 *
 * - Admin users: allowed from ANY IP (no restriction)
 * - Users with pending/rejected status: blocked regardless of IP
 * - Regular users: must come from an IP in ALLOWED_IPS (if configured)
 * - Unauthenticated requests to /api (non-auth): subject to IP check
 */
export const ipWhitelist = (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as IUser | undefined;

    // Admins bypass the IP whitelist entirely — they can work from anywhere
    if (user?.role === 'admin') return next();

    // Block users whose access is pending or rejected BEFORE checking IP
    if (user && user.status !== 'active') {
        res.status(403).json({
            error: 'ACCESS_PENDING',
            message: user.status === 'pending'
                ? 'Your account is pending approval from an administrator.'
                : 'Your account access has been revoked.',
        });
        return;
    }

    const allowedIps = process.env.ALLOWED_IPS?.split(',').map(ip => ip.trim()).filter(Boolean) || [];

    // If no IPs configured, allow all (open mode)
    if (allowedIps.length === 0) return next();

    // Extract client IP — handles proxied requests (x-forwarded-for) and direct connections
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || req.socket.remoteAddress || '';

    // Normalize IPv6-mapped IPv4 (::ffff:1.2.3.4 → 1.2.3.4)
    const normalizedIp = clientIp.replace(/^::ffff:/, '');

    if (allowedIps.includes(normalizedIp)) return next();

    logger.warn(`Blocked request from unauthorized IP: ${normalizedIp} (user: ${user?.email ?? 'unauthenticated'})`);
    res.status(403).json({ error: 'Access denied. Your IP is not authorized.' });
};
