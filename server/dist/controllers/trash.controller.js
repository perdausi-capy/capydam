"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyTrash = exports.forceDeleteAsset = exports.restoreAsset = exports.getTrash = void 0;
const prisma_1 = require("../lib/prisma");
// ✅ CORRECTED IMPORT: Use the new storage service
const storage_service_1 = require("../services/storage.service");
// 1. GET /assets/trash - List deleted items
const getTrash = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;
        const skip = (page - 1) * limit;
        // Fetch items WHERE deletedAt is NOT null
        const [assets, total] = await Promise.all([
            prisma_1.prisma.asset.findMany({
                where: { NOT: { deletedAt: null } },
                orderBy: { deletedAt: 'desc' }, // Newest trash first
                skip,
                take: limit,
            }),
            prisma_1.prisma.asset.count({ where: { NOT: { deletedAt: null } } })
        ]);
        res.json({
            results: assets,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    }
    catch (error) {
        console.error("Get Trash Error:", error);
        res.status(500).json({ error: 'Failed to fetch trash' });
    }
};
exports.getTrash = getTrash;
// 2. POST /assets/:id/restore - Restore from Trash
const restoreAsset = async (req, res) => {
    try {
        const asset = await prisma_1.prisma.asset.update({
            where: { id: req.params.id },
            data: { deletedAt: null } // ♻️ Set deletedAt back to null
        });
        res.json({ message: 'Asset restored successfully', asset });
    }
    catch (error) {
        console.error("Restore Error:", error);
        res.status(500).json({ error: 'Failed to restore asset' });
    }
};
exports.restoreAsset = restoreAsset;
// 3. DELETE /assets/:id/force - Permanently Delete
const forceDeleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma_1.prisma.asset.findUnique({ where: { id } });
        if (!asset)
            return res.status(404).json({ message: 'Asset not found' });
        console.log(`🔥 Force Deleting Asset: ${asset.originalName} (${id})`);
        // A. Delete physical files from MinIO (Cloud)
        // We use try/catch here so if the file is already gone, we still delete the DB record
        try {
            if (asset.path)
                await (0, storage_service_1.deleteFromSupabase)(asset.path);
            if (asset.thumbnailPath)
                await (0, storage_service_1.deleteFromSupabase)(asset.thumbnailPath);
            // Delete video previews if they exist
            if (asset.previewFrames && asset.previewFrames.length > 0) {
                await Promise.all(asset.previewFrames.map(frame => (0, storage_service_1.deleteFromSupabase)(frame)));
            }
        }
        catch (storageError) {
            console.warn("⚠️ Storage delete warning (continuing to DB):", storageError);
        }
        // B. Delete DB records (Transaction to handle Foreign Keys)
        // We must remove connections to Collections/Categories first!
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.assetOnCollection.deleteMany({ where: { assetId: id } }),
            prisma_1.prisma.assetOnCategory.deleteMany({ where: { assetId: id } }),
            prisma_1.prisma.assetClick.deleteMany({ where: { assetId: id } }), // Clean up analytics
            prisma_1.prisma.asset.delete({ where: { id } }) // Finally delete the asset
        ]);
        res.json({ message: 'Asset permanently deleted' });
    }
    catch (error) {
        console.error("Force Delete Error:", error);
        res.status(500).json({ error: 'Failed to delete asset permanently' });
    }
};
exports.forceDeleteAsset = forceDeleteAsset;
// 4. DELETE /assets/trash/empty - Empty Trash
const emptyTrash = async (req, res) => {
    try {
        // 1. Find all trash items
        const assets = await prisma_1.prisma.asset.findMany({ where: { NOT: { deletedAt: null } } });
        if (assets.length === 0) {
            return res.json({ message: 'Trash is already empty' });
        }
        console.log(`🗑️ Emptying Trash: ${assets.length} items...`);
        // 2. Delete all files from Storage
        for (const asset of assets) {
            try {
                if (asset.path)
                    await (0, storage_service_1.deleteFromSupabase)(asset.path);
                if (asset.thumbnailPath)
                    await (0, storage_service_1.deleteFromSupabase)(asset.thumbnailPath);
                if (asset.previewFrames && asset.previewFrames.length > 0) {
                    await Promise.all(asset.previewFrames.map(frame => (0, storage_service_1.deleteFromSupabase)(frame)));
                }
            }
            catch (err) {
                console.warn(`Failed to delete file for ${asset.id}`, err);
            }
        }
        // 3. Delete all DB records (Transaction)
        const assetIds = assets.map(a => a.id);
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.assetOnCollection.deleteMany({ where: { assetId: { in: assetIds } } }),
            prisma_1.prisma.assetOnCategory.deleteMany({ where: { assetId: { in: assetIds } } }),
            prisma_1.prisma.assetClick.deleteMany({ where: { assetId: { in: assetIds } } }),
            prisma_1.prisma.asset.deleteMany({ where: { id: { in: assetIds } } })
        ]);
        res.json({ message: 'Trash emptied successfully' });
    }
    catch (error) {
        console.error("Empty Trash Error:", error);
        res.status(500).json({ error: 'Failed to empty trash' });
    }
};
exports.emptyTrash = emptyTrash;
