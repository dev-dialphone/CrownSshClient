import { Request, Response, NextFunction } from 'express';
import { IUser } from '../models/User.js';

type Role = 'admin' | 'user';

/**
 * Middleware to require a specific role.
 * Must be used AFTER requireAuth.
 * Usage: router.use(requireRole('admin'))
 */
export const requireRole = (role: Role) => (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as IUser | undefined;

    if (!user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    if (role === 'admin' && user.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden: Admin access required.' });
        return;
    }

    next();
};
