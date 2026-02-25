import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { emailService } from '../services/emailService.js';
import { logEvent } from '../services/auditService.js';
import { IUser } from '../models/User.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get('/settings', asyncHandler(async (req, res) => {
    const settings = await emailService.getSettings();
    
    const safeSettings = {
        ...settings,
        smtpPassword: settings.smtpPassword ? '••••••••' : '',
    };
    
    res.json(safeSettings);
}));

router.patch('/settings', asyncHandler(async (req, res) => {
    const actor = req.user as IUser;
    const updates = req.body;
    
    const allowedKeys = [
        'email.enabled',
        'email.smtpHost',
        'email.smtpPort',
        'email.smtpSecure',
        'email.smtpUser',
        'email.smtpPassword',
        'email.fromName',
        'email.fromEmail',
        'email.recipients',
        'email.notifyVmDown',
        'email.notifyVmRecovered',
        'email.notifyNewUser',
        'email.notifyUserApproved',
        'email.notifyUserRejected',
        'email.cooldownMinutes',
        'email.dailyCap',
    ];
    
    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
        if (allowedKeys.includes(key)) {
            filteredUpdates[key] = value;
        }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
        res.status(400).json({ error: 'No valid settings to update' });
        return;
    }
    
    await emailService.updateSettings(filteredUpdates);
    
    await logEvent({
        actorId: actor._id.toString(),
        actorEmail: actor.email,
        actorRole: actor.role,
        action: 'SETTING_UPDATED',
        target: 'email',
        metadata: { keys: Object.keys(filteredUpdates) },
    });
    
    res.json({ success: true });
}));

router.post('/test', asyncHandler(async (req, res) => {
    const { to } = req.body;
    
    if (!to || typeof to !== 'string') {
        res.status(400).json({ error: 'Email address required' });
        return;
    }
    
    const result = await emailService.sendTestEmail(to);
    
    if (result.success) {
        res.json({ success: true, message: 'Test email sent successfully' });
    } else {
        res.status(400).json({ error: result.error || 'Failed to send test email' });
    }
}));

router.post('/test-connection', asyncHandler(async (req, res) => {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword } = req.body;
    
    const testSettings = {
        enabled: true,
        smtpHost: smtpHost || '',
        smtpPort: smtpPort || 587,
        smtpSecure: smtpSecure || false,
        smtpUser: smtpUser || '',
        smtpPassword: smtpPassword || '',
        fromName: 'SSH Manager',
        fromEmail: smtpUser || '',
        recipients: [],
        notifyVmDown: true,
        notifyVmRecovered: true,
        notifyNewUser: true,
        notifyUserApproved: true,
        notifyUserRejected: true,
        cooldownMinutes: 15,
        dailyCap: 100,
    };
    
    const result = await emailService.testConnection(testSettings);
    
    if (result.success) {
        res.json({ success: true, message: 'SMTP connection successful' });
    } else {
        res.status(400).json({ error: result.error || 'Connection failed' });
    }
}));

router.get('/logs', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const { logs, total } = await emailService.getEmailLogs(page, limit);
    
    res.json({ logs, total, page, limit });
}));

router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await emailService.getEmailStats();
    res.json(stats);
}));

export default router;
