"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const asset_controller_1 = require("../controllers/asset.controller");
// ✅ IMPORT TRASH CONTROLLERS
// Ensure you renamed the file to 'trash.controller.ts' to match your style
const trash_controller_1 = require("../controllers/trash.controller");
const router = (0, express_1.Router)();
// --- MULTER CONFIG ---
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        // Ensure this folder exists in your project root!
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});
// --- ROUTES ---
// 1. TRASH ROUTES (⚠️ Must come BEFORE generic /:id routes)
// Ideally, add an 'isAdmin' middleware here if you have one
router.get('/trash', auth_middleware_1.verifyJWT, trash_controller_1.getTrash); // GET /api/assets/trash
router.delete('/trash/empty', auth_middleware_1.verifyJWT, trash_controller_1.emptyTrash); // DELETE /api/assets/trash/empty
// 2. STATIC & ACTION ROUTES
router.post('/upload', auth_middleware_1.verifyJWT, upload.single('file'), asset_controller_1.uploadAsset);
router.post('/track-click', auth_middleware_1.verifyJWT, asset_controller_1.trackAssetClick);
// 3. SEARCH / BROWSE
router.get('/', auth_middleware_1.verifyJWT, asset_controller_1.getAssets);
// 4. SPECIFIC ID ROUTES (Must come BEFORE generic /:id)
router.get('/:id/related', auth_middleware_1.verifyJWT, asset_controller_1.getRelatedAssets);
// ✅ TRASH ITEM ACTIONS
router.post('/:id/restore', auth_middleware_1.verifyJWT, trash_controller_1.restoreAsset); // POST /api/assets/:id/restore
router.delete('/:id/force', auth_middleware_1.verifyJWT, trash_controller_1.forceDeleteAsset); // DELETE /api/assets/:id/force
// 5. GENERIC ID ROUTES (Catch-all for IDs)
router.get('/:id', auth_middleware_1.verifyJWT, asset_controller_1.getAssetById);
router.patch('/:id', auth_middleware_1.verifyJWT, asset_controller_1.updateAsset);
router.delete('/:id', auth_middleware_1.verifyJWT, asset_controller_1.deleteAsset); // Soft Delete
exports.default = router;
