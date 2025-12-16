"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const collection_controller_1 = require("../controllers/collection.controller");
const router = (0, express_1.Router)();
// Apply JWT check to all routes
router.use(auth_middleware_1.verifyJWT);
// 1. Get All (My Collections)
router.get('/', collection_controller_1.getCollections);
// 2. Get One (Specific Collection)
router.get('/:id', collection_controller_1.getCollectionById);
// 3. Create Collection
router.post('/', collection_controller_1.createCollection);
// 4. Add Asset to Collection
router.post('/:id/assets', collection_controller_1.addAssetToCollection);
// 5. Remove Asset from Collection
// ✅ Matches controller: const { id, assetId } = req.params;
router.delete('/:id/assets/:assetId', collection_controller_1.removeAssetFromCollection);
router.patch('/:id', collection_controller_1.updateCollection);
router.delete('/:id', collection_controller_1.deleteCollection);
exports.default = router;
