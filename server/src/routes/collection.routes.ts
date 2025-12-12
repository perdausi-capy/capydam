import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { 
  getCollections, 
  getCollectionById, 
  createCollection, 
  addAssetToCollection, 
  removeAssetFromCollection,
  updateCollection, 
  deleteCollection 
} from '../controllers/collection.controller';

const router = Router();

// Apply JWT check to all routes
router.use(verifyJWT);

// 1. Get All (My Collections)
router.get('/', getCollections);

// 2. Get One (Specific Collection)
router.get('/:id', getCollectionById);

// 3. Create Collection
router.post('/', createCollection);

// 4. Add Asset to Collection
router.post('/:id/assets', addAssetToCollection);

// 5. Remove Asset from Collection
// ✅ Matches controller: const { id, assetId } = req.params;
router.delete('/:id/assets/:assetId', removeAssetFromCollection);

router.patch('/:id', updateCollection);
router.delete('/:id', deleteCollection);

export default router;