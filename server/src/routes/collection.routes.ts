import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { 
  getCollections, 
  getCollectionById, // <--- Name was changed to this
  createCollection, 
  addAssetToCollection, 
  removeAssetFromCollection 
} from '../controllers/collection.controller';

const router = Router();

// 1. Get All (My Collections)
router.get('/', verifyJWT, getCollections);

// 2. Get One (Specific Collection)
router.get('/:id', verifyJWT, getCollectionById); // <--- Use correct function

// 3. Create
router.post('/', verifyJWT, createCollection);

// 4. Add Asset
router.post('/:id/assets', verifyJWT, addAssetToCollection);

// 5. Remove Asset
router.delete('/:id/assets/:assetId', verifyJWT, removeAssetFromCollection);

export default router;