import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { 
  getCategories, 
  createCategory, 
  deleteCategory,
  updateCategory,
  getCategoryById, 
  addAssetToCategory, 
  removeAssetFromCategory 
} from '../controllers/category.controller';
import path from 'path';
import multer from 'multer';

const router = Router();

// Configure Multer for temporary storage
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'), 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for covers
});

// Routes
router.get('/', verifyJWT, getCategories);

// ✅ FIX: Add 'upload.single' middleware here to handle FormData/Image uploads
router.post('/', verifyJWT, upload.single('cover'), createCategory);

router.get('/:id', verifyJWT, getCategoryById);
router.post('/:id/assets', verifyJWT, addAssetToCategory);

// Update route (already had it, but kept for consistency)
router.patch('/:id', verifyJWT, upload.single('cover'), updateCategory);

router.delete('/:id', verifyJWT, deleteCategory);
router.delete('/:id/assets/:assetId', verifyJWT, removeAssetFromCategory);

export default router;