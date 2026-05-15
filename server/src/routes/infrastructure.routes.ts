import { Router } from 'express';
import multer from 'multer'; // ✅ Import multer
import { getNodes, createNode, updateNode, deleteNode, uploadKeyFile, deleteKeyFile } from '../controllers/infrastructure.controller';
import { verifyJWT, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Store file in memory to securely pass to the DB (prevents saving to public disk)
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', verifyJWT, requireAdmin, getNodes);
router.post('/', verifyJWT, requireAdmin, createNode);
router.put('/:id', verifyJWT, requireAdmin, updateNode);
router.delete('/:id', verifyJWT, requireAdmin, deleteNode);

// ✅ NEW: Real File Manager Routes
router.post('/:id/key', verifyJWT, requireAdmin, upload.single('keyFile'), uploadKeyFile);
router.delete('/:id/key', verifyJWT, requireAdmin, deleteKeyFile);

export default router;