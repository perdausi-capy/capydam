"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const daily_controller_1 = require("../controllers/daily.controller");
const router = (0, express_1.Router)();
// Setup Multer (Memory Storage) for File Uploads
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
/* =========================================
   PUBLIC / USER ROUTES
   ========================================= */
router.get('/', auth_middleware_1.verifyJWT, daily_controller_1.getActiveQuestion); // Get currently active quest
router.get('/active', auth_middleware_1.verifyJWT, daily_controller_1.getActiveQuestion); // Alias for above
router.get('/leaderboard', auth_middleware_1.verifyJWT, daily_controller_1.getLeaderboard); // Get rankings (Season/AllTime)
router.get('/recap', auth_middleware_1.verifyJWT, daily_controller_1.getLastSeasonRecap);
router.post('/vote', auth_middleware_1.verifyJWT, daily_controller_1.submitVote); // Submit a vote
// 🐹 2. REGISTER THE GOLDEN CAPY ROUTE HERE
router.get('/golden-status', auth_middleware_1.verifyJWT, daily_controller_1.getGoldenStatus);
router.post('/claim-golden-capy', auth_middleware_1.verifyJWT, daily_controller_1.claimGoldenCapy);
/* =========================================
   ADMIN: DASHBOARD & MANAGEMENT
   ========================================= */
router.get('/stats', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.getQuestStats); // Dashboard Stats
router.get('/:id/details', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.getQuestDetails);
router.post('/create', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.createDailyQuestion); // Create/Schedule
router.patch('/:id/close', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.closeQuest); // Manual Stop
/* =========================================
   ADMIN: SEASON CONTROL
   ========================================= */
router.post('/season/start', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.startSeason); // 🟢 Start New Season
router.post('/season/end', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.endSeason); // 🔴 End/Freeze Season
router.post('/admin/nuke-all', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.resetAllTimeStats); // ☢️ Factory Reset
/* =========================================
   ADMIN: TOOLS & VAULT
   ========================================= */
router.post('/generate', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.generateDailyQuestion); // Random from Vault
router.post('/import-ai', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, upload.single('file'), daily_controller_1.aiSmartImport); // Import File
router.patch('/:id/unschedule', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.unscheduleQuest); // Move Schedule -> Vault
/* =========================================
   ADMIN: CLEANUP & DELETE
   ========================================= */
router.delete('/vault/clear', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.clearVault); // Clear unused drafts
router.delete('/history/clear', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.clearHistory); // Clear past logs
router.delete('/:id', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.deleteDailyQuestion); // Delete specific item
// ✅ ADD THESE TWO NEW ROUTES HERE:
router.post('/recycle-all', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.recycleAllHistory);
router.post('/recycle/:id', auth_middleware_1.verifyJWT, auth_middleware_1.requireAdmin, daily_controller_1.recycleToVault);
exports.default = router;
