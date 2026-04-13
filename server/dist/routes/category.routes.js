"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const category_controller_1 = require("../controllers/category.controller");
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
// Configure Multer for temporary storage
const upload = (0, multer_1.default)({
    dest: path_1.default.join(__dirname, '../../uploads/temp'),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for covers
});
// Routes
router.get('/', auth_middleware_1.verifyJWT, category_controller_1.getCategories);
// ✅ FIX: Add 'upload.single' middleware here to handle FormData/Image uploads
router.post('/', auth_middleware_1.verifyJWT, upload.single('cover'), category_controller_1.createCategory);
router.get('/:id', auth_middleware_1.verifyJWT, category_controller_1.getCategoryById);
router.post('/:id/assets', auth_middleware_1.verifyJWT, category_controller_1.addAssetToCategory);
// Update route (already had it, but kept for consistency)
router.patch('/:id', auth_middleware_1.verifyJWT, upload.single('cover'), category_controller_1.updateCategory);
router.delete('/:id', auth_middleware_1.verifyJWT, category_controller_1.deleteCategory);
router.delete('/:id/assets/:assetId', auth_middleware_1.verifyJWT, category_controller_1.removeAssetFromCategory);
exports.default = router;
