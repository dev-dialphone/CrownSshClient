import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getAuditLogs } from '../services/auditService.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/**
 * GET /api/audit-logs?page=1&limit=50
 * Returns paginated audit log entries
 */
router.get('/', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await getAuditLogs(page, limit);
    res.json(result);
}));

export default router;
