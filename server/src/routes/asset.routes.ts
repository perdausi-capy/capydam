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

// ✅ IMPORT TRASH CONTROLLERS
// Ensure you renamed the file to 'trash.controller.ts' to match your style
import { 
    getTrash, 
    restoreAsset, 
    forceDeleteAsset, 
    emptyTrash 
} from '../controllers/trash.controller';

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

// 1. TRASH ROUTES (⚠️ Must come BEFORE generic /:id routes)
// Ideally, add an 'isAdmin' middleware here if you have one
router.get('/trash', verifyJWT, getTrash);             // GET /api/assets/trash
router.delete('/trash/empty', verifyJWT, emptyTrash);  // DELETE /api/assets/trash/empty

// 2. STATIC & ACTION ROUTES
router.post('/upload', verifyJWT, upload.single('file'), uploadAsset);
router.post('/track-click', verifyJWT, trackAssetClick);

// 3. SEARCH / BROWSE
router.get('/', verifyJWT, getAssets);

// 4. SPECIFIC ID ROUTES (Must come BEFORE generic /:id)
router.get('/:id/related', verifyJWT, getRelatedAssets);

// ✅ TRASH ITEM ACTIONS
router.post('/:id/restore', verifyJWT, restoreAsset);    // POST /api/assets/:id/restore
router.delete('/:id/force', verifyJWT, forceDeleteAsset); // DELETE /api/assets/:id/force

// 5. GENERIC ID ROUTES (Catch-all for IDs)
router.get('/:id', verifyJWT, getAssetById);
router.patch('/:id', verifyJWT, updateAsset);
router.delete('/:id', verifyJWT, deleteAsset); // Soft Delete

export default router;