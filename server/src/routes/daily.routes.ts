import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';
import { createDailyQuestion, getActiveQuestion, submitVote, closeQuest, getQuestStats } from '../controllers/daily.controller';

const router = Router();

// Public / User Routes
router.get('/', verifyJWT, getActiveQuestion);
router.get('/active', verifyJWT, getActiveQuestion);
router.post('/vote', verifyJWT, submitVote);

// Admin Routes
router.post('/create', verifyJWT, requireAdmin, createDailyQuestion);

// ✅ ADD THIS LINE to fix the "Force Close" button
router.patch('/:id/close', verifyJWT, requireAdmin, closeQuest);

router.get('/stats', verifyJWT, requireAdmin, getQuestStats);

export default router;