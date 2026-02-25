import { Router } from 'express';
import passport from 'passport';
import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/logger.js';
import { IUser } from '../models/User.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { logEvent } from '../services/auditService.js';
import { Setting } from '../models/Setting.js';

const router = Router();

const getRequiredPin = async (): Promise<string> => {
    const setting = await Setting.findOne({ key: 'requiredPin' });
    if (setting && typeof setting.value === 'string') {
        return setting.value;
    }
    if (!process.env.VITE_REQUIRED_PIN) {
        throw new Error('VITE_REQUIRED_PIN is not configured');
    }
    return process.env.VITE_REQUIRED_PIN;
};

// Google Auth Trigger
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Auth Callback
router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err: any, user: any, info: any) => {
    if (err) {
      logger.error('Passport auth error:', err);
      return res.redirect(`/login?error=${encodeURIComponent(err.message || 'Authentication failed')}`);
    }
    if (!user) {
      return res.redirect(`/login?error=${encodeURIComponent(info?.message || 'User not found')}`);
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        logger.error('Passport login error:', loginErr);
        return res.redirect(`/login?error=${encodeURIComponent(loginErr.message || 'Login failed')}`);
      }

      // Log LOGIN event
      logEvent({
        actorId: (user as any)._id?.toString() || (user as any).id,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'LOGIN',
        metadata: { provider: 'google' }
      }).catch(err => logger.error('Failed to log login event:', err));

      // Explicitly save session before redirecting to avoid race conditions with MongoDB store
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Session save error:', saveErr);
        }
        // Redirect to the root of the site (the dashboard)
        res.redirect('/');
      });
    });
  })(req, res, next);
});

// Get current user (includes role and 2FA status)
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    const user = req.user as IUser;
    res.json({
      user: {
        id: (user as any)._id?.toString() || (user as any).id,
        displayName: user.displayName,
        email: user.email,
        photos: user.photo ? [{ value: user.photo }] : [],
        role: user.role,
        status: user.status,
        isTotpEnabled: user.isTotpEnabled || false,
      }
    });
  } else {
    res.status(401).json({ user: null });
  }
}));

// Logout
router.post('/logout', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IUser;
  
  // Log LOGOUT event before destroying session
  if (user) {
    logEvent({
      actorId: (user as any)._id?.toString() || (user as any).id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'LOGOUT'
    }).catch(err => logger.error('Failed to log logout event:', err));
  }

  req.logout((err) => {
    if (err) { return next(err); }
    res.json({ success: true });
  });
}));

// Get all users (admin only) - for role management
router.get('/users', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const users = await User.find({}, '-totpSecret').lean();
  const formatted = users.map((u: any) => ({
    id: u._id.toString(),
    displayName: u.displayName,
    email: u.email,
    photo: u.photo,
    role: u.role,
  }));
  res.json(formatted);
}));

// Update user role (admin only)
router.put('/users/:id/role', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.body;
  if (!role || !['admin', 'user'].includes(role)) {
    res.status(400).json({ error: 'Invalid role. Must be "admin" or "user".' });
    return;
  }

  const updated = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
  if (!updated) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    id: updated._id.toString(),
    displayName: updated.displayName,
    email: updated.email,
    role: updated.role,
  });
}));

// Verify PIN
router.post('/verify-pin', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { pin } = req.body;
  const requiredPin = await getRequiredPin();
  
  if (pin === requiredPin) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Invalid PIN' });
  }
}));

// Get PIN setting (admin only)
router.get('/pin', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const pin = await getRequiredPin();
  res.json({ pin });
}));

// Update PIN (admin only)
router.put('/pin', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const actor = req.user as IUser;
  const { pin } = req.body;
  
  if (!pin || typeof pin !== 'string' || pin.length < 4) {
    res.status(400).json({ error: 'PIN must be at least 4 characters' });
    return;
  }
  
  await Setting.findOneAndUpdate(
    { key: 'requiredPin' },
    { key: 'requiredPin', value: pin },
    { upsert: true, new: true }
  );
  
  await logEvent({
    actorId: (actor as any)._id?.toString() || (actor as any).id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'SETTING_UPDATED',
    target: 'requiredPin',
    metadata: { updated: true },
  });
  
  res.json({ success: true, pin });
}));

export default router;
