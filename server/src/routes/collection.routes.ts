import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { 
  createCollection, 
  getCollections, 
  getCollection, 
  addAssetToCollection,
  removeAssetFromCollection 
} from '../controllers/collection.controller';

const router = Router();

router.post('/', verifyJWT, createCollection);
router.get('/', verifyJWT, getCollections);
router.get('/:id', verifyJWT, getCollection);
router.post('/:id/assets', verifyJWT, addAssetToCollection);
router.delete('/:id/assets/:assetId', verifyJWT, removeAssetFromCollection);

export default router;