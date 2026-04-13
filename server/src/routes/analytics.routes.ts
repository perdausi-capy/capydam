import { Router } from 'express';
import { getSystemAnalytics, recordSiteVisit, recordUserLog, getUserAuditLogs } from '../controllers/analytics.controller'; // Add getUserAuditLogs here
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Tracking Routes (Public / Regular Users)
router.post('/visit', recordSiteVisit);
router.post('/log', verifyJWT, recordUserLog);

// Dashboard Routes (Admins Only)
router.get('/', verifyJWT, requireAdmin, getSystemAnalytics);
router.get('/user/:userId', verifyJWT, requireAdmin, getUserAuditLogs); // ✅ NEW ROUTE

export default router;