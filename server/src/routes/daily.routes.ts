import multer from 'multer';
import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';
import { 
  // Core Game
  getActiveQuestion, 
  submitVote, 
  
  // Admin Dashboard
  createDailyQuestion, 
  closeQuest, 
  getQuestStats, 
  
  // Season & Leaderboard
  getLeaderboard, 
  startSeason, // ✅ Updated
  endSeason,   // ✅ Updated
  resetAllTimeStats,

  // Tools & Vault
  generateDailyQuestion, 
  aiSmartImport,
  unscheduleQuest,

  // Cleanup
  deleteDailyQuestion,
  clearVault,
  clearHistory
} from '../controllers/daily.controller';

const router = Router();

// Setup Multer (Memory Storage) for File Uploads
const upload = multer({ storage: multer.memoryStorage() });

/* =========================================
   PUBLIC / USER ROUTES
   ========================================= */
router.get('/', verifyJWT, getActiveQuestion);         // Get currently active quest
router.get('/active', verifyJWT, getActiveQuestion);   // Alias for above
router.get('/leaderboard', verifyJWT, getLeaderboard); // Get rankings (Season/AllTime)
router.post('/vote', verifyJWT, submitVote);           // Submit a vote

/* =========================================
   ADMIN: DASHBOARD & MANAGEMENT
   ========================================= */
router.get('/stats', verifyJWT, requireAdmin, getQuestStats);        // Dashboard Stats
router.post('/create', verifyJWT, requireAdmin, createDailyQuestion);// Create/Schedule
router.patch('/:id/close', verifyJWT, requireAdmin, closeQuest);     // Manual Stop

/* =========================================
   ADMIN: SEASON CONTROL
   ========================================= */
router.post('/season/start', verifyJWT, requireAdmin, startSeason);      // 🟢 Start New Season
router.post('/season/end', verifyJWT, requireAdmin, endSeason);          // 🔴 End/Freeze Season
router.post('/admin/nuke-all', verifyJWT, requireAdmin, resetAllTimeStats); // ☢️ Factory Reset

/* =========================================
   ADMIN: TOOLS & VAULT
   ========================================= */
router.post('/generate', verifyJWT, requireAdmin, generateDailyQuestion); // Random from Vault
router.post('/import-ai', verifyJWT, requireAdmin, upload.single('file'), aiSmartImport); // Import File
router.patch('/:id/unschedule', verifyJWT, requireAdmin, unscheduleQuest);// Move Schedule -> Vault

/* =========================================
   ADMIN: CLEANUP & DELETE
   ========================================= */
router.delete('/vault/clear', verifyJWT, requireAdmin, clearVault);     // Clear unused drafts
router.delete('/history/clear', verifyJWT, requireAdmin, clearHistory); // Clear past logs
router.delete('/:id', verifyJWT, requireAdmin, deleteDailyQuestion);    // Delete specific item

export default router;