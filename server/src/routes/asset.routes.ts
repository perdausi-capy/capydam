import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { verifyJWT } from '../middleware/auth.middleware'; // We need to create this! // already created 
import { uploadAsset, getAssets, getAssetById, updateAsset, deleteAsset } from '../controllers/asset.controller';


const router = Router();

// Configure Multer Storage (Local)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp-random-originalName
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// Routes
// POST /api/assets/upload (Protected)
router.post('/upload', verifyJWT, upload.single('file'), uploadAsset);

// GET /api/assets (Protected)
router.get('/', verifyJWT, getAssets);

// GET /api/assets/:id (Fetch single asset)
router.get('/:id', verifyJWT, getAssetById);

// PATCH /api/assets/:id (Update metadata)
router.patch('/:id', verifyJWT, updateAsset);

// DELETE /api/assets/:id
router.delete('/:id', verifyJWT, deleteAsset);

export default router;