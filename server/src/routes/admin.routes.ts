import { Router } from 'express';
import { getAdminStats } from '../controllers/admin.controller';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware'; 

const router = Router();

// GET /api/admin/stats
router.get('/stats', verifyJWT, requireAdmin, getAdminStats);

export default router;