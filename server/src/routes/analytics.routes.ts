import { Router } from 'express';
import { getSystemAnalytics } from '../controllers/analytics.controller';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware'; 

const router = Router();

// Only Admins can see system analytics
router.get('/', verifyJWT, requireAdmin, getSystemAnalytics);

export default router;