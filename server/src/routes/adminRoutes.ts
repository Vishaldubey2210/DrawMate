import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getReports,
  updateReportStatus,
  performModerationAction,
  getAuditLogs,
  getAdminUsers,
} from '../controllers/moderationController.js';
import {
  getOperationalMetrics,
  getProductAnalytics,
  getIncidentDiagnostics,
  updateFeatureFlags,
  getAdminFeedbacks,
  updateFeedbackStatus,
  broadcastEmail,
} from '../controllers/observabilityController.js';

const router = Router();

// Base protection: all admin routes require authentication
router.use(requireAuth);

// Moderator or Admin access
router.get('/reports', requireRole(['moderator', 'admin']), getReports);
router.patch('/reports/:id', requireRole(['moderator', 'admin']), updateReportStatus);
router.post('/moderation/action', requireRole(['moderator', 'admin']), performModerationAction);
router.get('/users', requireRole(['moderator', 'admin']), getAdminUsers);
router.get('/feedback', requireRole(['moderator', 'admin']), getAdminFeedbacks);
router.patch('/feedback/:id', requireRole(['moderator', 'admin']), updateFeedbackStatus);

// Strict Admin-only access
router.get('/audit-logs', requireRole(['admin']), getAuditLogs);
router.get('/metrics/operational', requireRole(['admin']), getOperationalMetrics);
router.get('/metrics/analytics', requireRole(['admin']), getProductAnalytics);
router.get('/incidents', requireRole(['admin']), getIncidentDiagnostics);
router.patch('/features', requireRole(['admin']), updateFeatureFlags);
router.post('/broadcast-email', requireRole(['admin']), broadcastEmail);

export default router;
