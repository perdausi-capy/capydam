"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const auth_middleware_1 = require("../middleware/auth.middleware"); // We need to create this! // already created 
const asset_controller_1 = require("../controllers/asset.controller");
const router = (0, express_1.Router)();
// Configure Multer Storage (Local)
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Unique filename: timestamp-random-originalName
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});
// Routes
// POST /api/assets/upload (Protected)
router.post('/upload', auth_middleware_1.verifyJWT, upload.single('file'), asset_controller_1.uploadAsset);
// GET /api/assets (Protected)
router.get('/', auth_middleware_1.verifyJWT, asset_controller_1.getAssets);
// GET /api/assets/:id (Fetch single asset)
router.get('/:id', auth_middleware_1.verifyJWT, asset_controller_1.getAssetById);
// GET /api/assets/:id/related
router.get('/:id/related', auth_middleware_1.verifyJWT, asset_controller_1.getRelatedAssets);
// POST /api/assets/track-click (For Analytics)
router.post('/track-click', auth_middleware_1.verifyJWT, asset_controller_1.trackAssetClick);
// PATCH /api/assets/:id (Update metadata)
router.patch('/:id', auth_middleware_1.verifyJWT, asset_controller_1.updateAsset);
// DELETE /api/assets/:id
router.delete('/:id', auth_middleware_1.verifyJWT, asset_controller_1.deleteAsset);
exports.default = router;
