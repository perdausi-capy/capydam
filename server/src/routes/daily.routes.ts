import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';
import { createDailyQuestion, getActiveQuestion, submitVote } from '../controllers/daily.controller';

const router = Router();

// ✅ FIX: This allows the base /api/daily to work
router.get('/', verifyJWT, getActiveQuestion);
// Users can see active questions and vote
router.get('/active', verifyJWT, getActiveQuestion);
router.post('/vote', verifyJWT, submitVote);

// Only Admins can create new questions
router.post('/create', verifyJWT, requireAdmin, createDailyQuestion);

export default router;