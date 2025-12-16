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
// 1. GET ALL (Filtered by Role)
const getCollections = async (req, res) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        // Check for optional query param if Admin wants to see specific user's folders
        // e.g. /api/collections?targetUserId=123
        const targetUserId = req.query.targetUserId;
        const whereClause = {
            parentId: null
        };
        // ✅ LOGIC:
        // 1. If Admin provides 'targetUserId', show that user's collections.
        // 2. Otherwise, ALWAYS filter by the logged-in userId (Admin sees their own, Viewer sees theirs).
        if (userRole === 'admin' && targetUserId) {
            whereClause.userId = targetUserId;
        }
        else {
            whereClause.userId = userId;
        }
        const collections = await prisma_1.prisma.collection.findMany({
            where: whereClause,
            include: {
                _count: {
                    select: { assets: true }
                },
                assets: {
                    take: 1,
                    include: {
                        asset: { select: { path: true, thumbnailPath: true, mimeType: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        const formatted = collections.map(c => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt,
            _count: c._count,
            coverImage: c.assets[0]?.asset.thumbnailPath || c.assets[0]?.asset.path || null
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error("Get Collections Error:", error);
        res.status(500).json({ message: 'Error fetching collections' });
    }
};
exports.getCollections = getCollections;
// 2. GET ONE (With Security Check)
const getCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const collection = await prisma_1.prisma.collection.findUnique({
            where: { id },
            include: {
                // ✅ Include Sub-folders
                children: {
                    include: { _count: { select: { assets: true } } }
                },
                // Include Assets
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
        // Security Check: Is this MY collection? (Skip if Admin)
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
// 3. CREATE
const createCollection = async (req, res) => {
    try {
        const { name, parentId } = req.body;
        const userId = req.user?.id;
        let slug = slugify(name);
        // Ensure unique slug
        const existing = await prisma_1.prisma.collection.findUnique({ where: { slug } });
        if (existing) {
            slug = `${slug}-${Date.now()}`;
        }
        const collection = await prisma_1.prisma.collection.create({
            data: {
                name,
                slug,
                userId,
                parentId: parentId || null
            }
        });
        res.status(201).json(collection);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating collection' });
    }
};
exports.createCollection = createCollection;
// 4. ADD ASSET TO COLLECTION
const addAssetToCollection = async (req, res) => {
    try {
        const { id } = req.params; // Collection ID
        const { assetId } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        // Check ownership
        const collection = await prisma_1.prisma.collection.findUnique({ where: { id } });
        if (!collection) {
            res.status(404).json({ message: 'Not found' });
            return;
        }
        if (userRole !== 'admin' && collection.userId !== userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }
        await prisma_1.prisma.assetOnCollection.create({
            data: {
                collectionId: id,
                assetId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
        // Ignore duplicate errors (P2002)
        res.json({ success: true });
    }
};
exports.addAssetToCollection = addAssetToCollection;
// 5. REMOVE ASSET
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
        await prisma_1.prisma.assetOnCollection.deleteMany({
            where: {
                collectionId: id,
                assetId: assetId
            }
        });
        res.json({ success: true });
    }
    catch (error) {
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
// 7. DELETE COLLECTION (Transactional)
const deleteCollection = async (req, res) => {
    try {
        const { id } = req.params;
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
        // Transaction: Empty the folder, then delete the folder
        await prisma_1.prisma.$transaction([
            // Remove links to assets inside this collection
            prisma_1.prisma.assetOnCollection.deleteMany({
                where: { collectionId: id }
            }),
            // Delete the collection itself
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
