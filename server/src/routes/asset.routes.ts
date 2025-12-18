import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { verifyJWT } from '../middleware/auth.middleware'; 
import { 
    uploadAsset, 
    getAssets, 
    getAssetById, 
    updateAsset, 
    deleteAsset, 
    getRelatedAssets, 
    trackAssetClick 
} from '../controllers/asset.controller';

const router = Router();

// --- MULTER CONFIG ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure this folder exists in your project root!
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// --- ROUTES ---

// 1. STATIC & ACTION ROUTES (Must come first)
// Upload
router.post('/upload', verifyJWT, upload.single('file'), uploadAsset);

// Analytics
router.post('/track-click', verifyJWT, trackAssetClick);

// Search / Browse
router.get('/', verifyJWT, getAssets);

// 2. SPECIFIC ID ROUTES (Must come BEFORE generic /:id)
// ✅ FIX: This guarantees 'related' is matched before 'getAssetById' tries to grab it
router.get('/:id/related', verifyJWT, getRelatedAssets);

// 3. GENERIC ID ROUTES (Catch-all for IDs)
router.get('/:id', verifyJWT, getAssetById);
router.patch('/:id', verifyJWT, updateAsset);
router.delete('/:id', verifyJWT, deleteAsset);

export default router;