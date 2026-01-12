import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
// ✅ CORRECTED IMPORT: Use the new storage service
import { deleteFromSupabase } from '../services/storage.service';

// 1. GET /assets/trash - List deleted items
export const getTrash = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    // Fetch items WHERE deletedAt is NOT null
    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where: { NOT: { deletedAt: null } },
        orderBy: { deletedAt: 'desc' }, // Newest trash first
        skip,
        take: limit,
      }),
      prisma.asset.count({ where: { NOT: { deletedAt: null } } })
    ]);

    res.json({
      results: assets,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error("Get Trash Error:", error);
    res.status(500).json({ error: 'Failed to fetch trash' });
  }
};

// 2. POST /assets/:id/restore - Restore from Trash
export const restoreAsset = async (req: Request, res: Response) => {
  try {
    const asset = await prisma.asset.update({
      where: { id: req.params.id },
      data: { deletedAt: null } // ♻️ Set deletedAt back to null
    });
    res.json({ message: 'Asset restored successfully', asset });
  } catch (error) {
    console.error("Restore Error:", error);
    res.status(500).json({ error: 'Failed to restore asset' });
  }
};

// 3. DELETE /assets/:id/force - Permanently Delete
export const forceDeleteAsset = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    console.log(`🔥 Force Deleting Asset: ${asset.originalName} (${id})`);

    // A. Delete physical files from MinIO (Cloud)
    // We use try/catch here so if the file is already gone, we still delete the DB record
    try {
        if (asset.path) await deleteFromSupabase(asset.path);
        if (asset.thumbnailPath) await deleteFromSupabase(asset.thumbnailPath);
        
        // Delete video previews if they exist
        if (asset.previewFrames && asset.previewFrames.length > 0) {
            await Promise.all(asset.previewFrames.map(frame => deleteFromSupabase(frame)));
        }
    } catch (storageError) {
        console.warn("⚠️ Storage delete warning (continuing to DB):", storageError);
    }

    // B. Delete DB records (Transaction to handle Foreign Keys)
    // We must remove connections to Collections/Categories first!
    await prisma.$transaction([
        prisma.assetOnCollection.deleteMany({ where: { assetId: id } }),
        prisma.assetOnCategory.deleteMany({ where: { assetId: id } }),
        prisma.assetClick.deleteMany({ where: { assetId: id } }), // Clean up analytics
        prisma.asset.delete({ where: { id } }) // Finally delete the asset
    ]);

    res.json({ message: 'Asset permanently deleted' });
  } catch (error) {
    console.error("Force Delete Error:", error);
    res.status(500).json({ error: 'Failed to delete asset permanently' });
  }
};

// 4. DELETE /assets/trash/empty - Empty Trash
export const emptyTrash = async (req: Request, res: Response) => {
  try {
    // 1. Find all trash items
    const assets = await prisma.asset.findMany({ where: { NOT: { deletedAt: null } } });
    
    if (assets.length === 0) {
        return res.json({ message: 'Trash is already empty' });
    }

    console.log(`🗑️ Emptying Trash: ${assets.length} items...`);

    // 2. Delete all files from Storage
    for (const asset of assets) {
        try {
            if (asset.path) await deleteFromSupabase(asset.path);
            if (asset.thumbnailPath) await deleteFromSupabase(asset.thumbnailPath);
            if (asset.previewFrames && asset.previewFrames.length > 0) {
                await Promise.all(asset.previewFrames.map(frame => deleteFromSupabase(frame)));
            }
        } catch (err) {
            console.warn(`Failed to delete file for ${asset.id}`, err);
        }
    }

    // 3. Delete all DB records (Transaction)
    const assetIds = assets.map(a => a.id);
    
    await prisma.$transaction([
        prisma.assetOnCollection.deleteMany({ where: { assetId: { in: assetIds } } }),
        prisma.assetOnCategory.deleteMany({ where: { assetId: { in: assetIds } } }),
        prisma.assetClick.deleteMany({ where: { assetId: { in: assetIds } } }),
        prisma.asset.deleteMany({ where: { id: { in: assetIds } } })
    ]);

    res.json({ message: 'Trash emptied successfully' });
  } catch (error) {
    console.error("Empty Trash Error:", error);
    res.status(500).json({ error: 'Failed to empty trash' });
  }
};