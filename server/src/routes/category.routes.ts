import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { 
  getCategories, 
  createCategory, // <--- Ensure this is imported
  deleteCategory,
  updateCategory,
  getCategoryById, 
  addAssetToCategory, 
  removeAssetFromCategory 
} from '../controllers/category.controller';
import path from 'path';
import multer from 'multer';

const router = Router();
const upload = multer({
  dest: path.join(__dirname, '../../uploads/temp'), 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit for covers
});

// Routes
router.get('/', verifyJWT, getCategories);
router.post('/', verifyJWT, createCategory); // <--- This is the one you are hitting
router.get('/:id', verifyJWT, getCategoryById);
router.post('/:id/assets', verifyJWT, addAssetToCategory);
router.patch('/:id', verifyJWT, upload.single('cover'), updateCategory);
router.delete('/:id', verifyJWT, deleteCategory);
router.delete('/:id/assets/:assetId', verifyJWT, removeAssetFromCategory);


export default router;