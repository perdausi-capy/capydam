"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCollection = exports.updateCollection = exports.removeAssetFromCollection = exports.addAssetToCollection = exports.createCollection = exports.getCollectionById = exports.getCollections = void 0;
const prisma_1 = require("../lib/prisma");
// Helper to generate slug
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(/[^\w\-]+/g, '') // Remove all non-word chars
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start
        .replace(/-+$/, ''); // Trim - from end
};
// 1. GET ALL (Super Optimized)
const getCollections = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const targetUserId = req.query.targetUserId;
        const whereClause = {
            parentId: null
        };
        // ✅ LOGIC: Admin view vs User view
        if (userRole === 'admin' && targetUserId) {
            whereClause.userId = targetUserId;
        }
        else {
            whereClause.userId = userId;
        }
        // ⚡️ OPTIMIZATION: 
        // 1. We fetch 'coverImage' directly from the column (No heavy joins!)
        // 2. We limit to 100 to prevent server overload
        const collections = await prisma_1.prisma.collection.findMany({
            where: whereClause,
            take: 100,
            select: {
                id: true,
                name: true,
                createdAt: true,
                coverImage: true, // Direct column access (Fast!)
                _count: {
                    select: { assets: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(collections);
    }
    catch (error) {
        console.error("Get Collections Error:", error);
        res.status(500).json({ message: 'Error fetching collections' });
    }
};
exports.getCollections = getCollections;
// 2. GET ONE (Unchanged)
const getCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const collection = await prisma_1.prisma.collection.findUnique({
            where: { id },
            include: {
                children: {
                    include: { _count: { select: { assets: true } } }
                },
                assets: {
                    include: {
                        asset: {
                            include: { uploadedBy: { select: { name: true } } }
                        }
                    }
                }
            }
        });
        if (!collection) {
            res.status(404).json({ message: 'Collection not found' });
            return;
        }
        if (userRole !== 'admin' && collection.userId !== userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }
        // Flatten structure for frontend convenience
        const flatCollection = {
            ...collection,
            assets: collection.assets.map(a => a.asset)
        };
        res.json(flatCollection);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getCollectionById = getCollectionById;
// 3. CREATE (Optimized: Fail-Fast Strategy)
const createCollection = async (req, res) => {
    try {
        const { name, parentId } = req.body;
        const userId = req.user?.id;
        const baseSlug = slugify(name);
        let slug = baseSlug;
        // ⚡️ OPTIMIZATION: Try to create immediately. 
        // We assume the name is unique most of the time.
        // This saves 1 DB call (findUnique) for every successful creation.
        try {
            const collection = await prisma_1.prisma.collection.create({
                data: {
                    name,
                    slug,
                    userId,
                    parentId: parentId || null
                }
            });
            res.status(201).json(collection);
            return;
        }
        catch (dbError) {
            // P2002 = Unique Constraint Failed (Slug collision)
            if (dbError.code === 'P2002') {
                // Collision happened! Now append timestamp and retry.
                slug = `${baseSlug}-${Date.now()}`;
                const collectionRetry = await prisma_1.prisma.collection.create({
                    data: {
                        name,
                        slug,
                        userId,
                        parentId: parentId || null
                    }
                });
                res.status(201).json(collectionRetry);
                return;
            }
            throw dbError; // Throw other errors to the main catch block
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating collection' });
    }
};
exports.createCollection = createCollection;
// 4. ADD ASSET TO COLLECTION (Auto-update Cover)
const addAssetToCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const { assetId } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        // 1. Fetch Collection to check rights & current cover status
        const collection = await prisma_1.prisma.collection.findUnique({
            where: { id },
            select: { userId: true, coverImage: true }
        });
        if (!collection) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        if (userRole !== 'admin' && collection.userId !== userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }
        // 2. Fetch the Asset details (we need the path for the cover)
        const asset = await prisma_1.prisma.asset.findUnique({
            where: { id: assetId },
            select: { thumbnailPath: true, path: true }
        });
        if (!asset) {
            res.status(404).json({ message: 'Asset not found' });
            return;
        }
        // 3. Prepare Transaction Operations
        const operations = [
            prisma_1.prisma.assetOnCollection.create({
                data: { collectionId: id, assetId }
            })
        ];
        // ✅ LOGIC: If collection has no cover, use this new asset immediately
        if (!collection.coverImage) {
            const newCover = asset.thumbnailPath || asset.path;
            operations.push(prisma_1.prisma.collection.update({
                where: { id },
                data: { coverImage: newCover }
            }));
        }
        // Execute all updates atomically
        await prisma_1.prisma.$transaction(operations);
        res.json({ success: true });
    }
    catch (error) {
        // Ignore P2002 (Duplicate entry) - means asset is already in collection
        res.json({ success: true });
    }
};
exports.addAssetToCollection = addAssetToCollection;
// 5. REMOVE ASSET (Recalculate Cover if needed)
const removeAssetFromCollection = async (req, res) => {
    try {
        const { id, assetId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const collection = await prisma_1.prisma.collection.findUnique({ where: { id } });
        if (!collection) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        if (userRole !== 'admin' && collection.userId !== userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }
        // 1. Get the asset we are about to remove (to check if it's the cover)
        const assetToRemove = await prisma_1.prisma.asset.findUnique({
            where: { id: assetId },
            select: { thumbnailPath: true, path: true }
        });
        // 2. Remove the link
        await prisma_1.prisma.assetOnCollection.deleteMany({
            where: { collectionId: id, assetId: assetId }
        });
        // 3. ✅ CHECK: Did we just delete the cover image?
        const currentCover = collection.coverImage;
        const removedImage = assetToRemove?.thumbnailPath || assetToRemove?.path;
        if (currentCover && removedImage && currentCover === removedImage) {
            // Find the most recent asset remaining in the collection
            // ✅ FIX: Use 'assignedAt' instead of 'createdAt'
            const nextAssetLink = await prisma_1.prisma.assetOnCollection.findFirst({
                where: { collectionId: id },
                include: { asset: { select: { thumbnailPath: true, path: true } } },
                orderBy: { assignedAt: 'desc' }
            });
            // If found, use it. If not (folder empty), set to null.
            const newCover = nextAssetLink?.asset.thumbnailPath || nextAssetLink?.asset.path || null;
            await prisma_1.prisma.collection.update({
                where: { id },
                data: { coverImage: newCover }
            });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Remove Asset Error:", error);
        res.status(500).json({ message: 'Error removing asset' });
    }
};
exports.removeAssetFromCollection = removeAssetFromCollection;
// 6. UPDATE COLLECTION (Rename)
const updateCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const collection = await prisma_1.prisma.collection.findUnique({ where: { id } });
        if (!collection) {
            res.status(404).json({ message: 'Collection not found' });
            return;
        }
        if (userRole !== 'admin' && collection.userId !== userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }
        const updated = await prisma_1.prisma.collection.update({
            where: { id },
            data: { name }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ message: 'Error updating collection' });
    }
};
exports.updateCollection = updateCollection;
// 7. DELETE COLLECTION (Recursive Force Delete)
const deleteCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        // 1. Fetch the collection AND all its children (recursive) to check permissions
        // Note: A simple check is enough, we will let the DB cascade handle the deep structure
        // provided we clean up the Asset links first.
        const collection = await prisma_1.prisma.collection.findUnique({ where: { id } });
        if (!collection) {
            res.status(404).json({ message: 'Collection not found' });
            return;
        }
        if (userRole !== 'admin' && collection.userId !== userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }
        // 2. FORCE DELETE STRATEGY
        // We need to find ALL descendent collection IDs to remove their AssetOnCollection links first.
        // Prisma doesn't support recursive deleteMany easily, so we fetch IDs first.
        // Get all collections owned by this user (optimization: we assume we only delete our own tree)
        const allUserCollections = await prisma_1.prisma.collection.findMany({
            where: { userId: collection.userId },
            select: { id: true, parentId: true }
        });
        // Helper to find all descendants of the target ID
        const getDescendants = (parentId) => {
            const children = allUserCollections.filter(c => c.parentId === parentId);
            let ids = children.map(c => c.id);
            children.forEach(c => {
                ids = [...ids, ...getDescendants(c.id)];
            });
            return ids;
        };
        const targetIds = [id, ...getDescendants(id)];
        // 3. TRANSACTION
        await prisma_1.prisma.$transaction([
            // A. Remove all asset links from the target folder AND all sub-folders
            prisma_1.prisma.assetOnCollection.deleteMany({
                where: { collectionId: { in: targetIds } }
            }),
            // B. Delete the parent collection. 
            // Since schema has `onDelete: Cascade` for `children`, this wipes the sub-folders automatically.
            prisma_1.prisma.collection.delete({
                where: { id }
            })
        ]);
        res.json({ message: 'Collection deleted successfully' });
    }
    catch (error) {
        console.error("Delete Collection Error:", error);
        res.status(500).json({ message: 'Error deleting collection' });
    }
};
exports.deleteCollection = deleteCollection;
