import multer from 'multer';
import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';
import { 
  createDailyQuestion, 
  getActiveQuestion, 
  submitVote, 
  closeQuest, 
  getQuestStats, 
  getLeaderboard, 
  aiSmartImport,
  generateDailyQuestion, // ✅ Import the new Vault Generator
  clearVault,
  clearHistory,
  deleteDailyQuestion
} from '../controllers/daily.controller';

const router = Router();

// Setup Multer (Memory Storage) for File Uploads
const upload = multer({ storage: multer.memoryStorage() });

// --- PUBLIC / USER ROUTES ---
router.get('/', verifyJWT, getActiveQuestion);
router.get('/active', verifyJWT, getActiveQuestion);
router.get('/leaderboard', verifyJWT, getLeaderboard);
router.post('/vote', verifyJWT, submitVote);

// ✅ NEW DELETE ROUTES
router.delete('/vault/clear', verifyJWT, requireAdmin, clearVault);
router.delete('/history/clear', verifyJWT, requireAdmin, clearHistory);
router.delete('/:id', verifyJWT, requireAdmin, deleteDailyQuestion);

// --- ADMIN ROUTES ---
router.post('/create', verifyJWT, requireAdmin, createDailyQuestion);

// ✅ UPDATED: Points to Vault Generator instead of OpenAI
router.post('/generate', verifyJWT, requireAdmin, generateDailyQuestion); 

// ✅ UPDATED: Single definition with Multer middleware
router.post('/import-ai', verifyJWT, requireAdmin, upload.single('file'), aiSmartImport);

// Manual Close
router.patch('/:id/close', verifyJWT, requireAdmin, closeQuest);

// Stats & Vault Data
router.get('/stats', verifyJWT, requireAdmin, getQuestStats);

export default router;