import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

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
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    // A. Delete physical file
    const filePath = path.join(process.cwd(), 'uploads', asset.filename); 
    if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error("File delete error:", e); }
    }

    // B. Delete thumbnail if exists
    if (asset.thumbnailPath) {
        const thumbPath = path.join(process.cwd(), 'uploads', asset.thumbnailPath);
        if (fs.existsSync(thumbPath)) {
            try { fs.unlinkSync(thumbPath); } catch (e) { console.error("Thumb delete error:", e); }
        }
    }

    // C. Delete DB record
    await prisma.asset.delete({ where: { id: req.params.id } });

    res.json({ message: 'Asset permanently deleted' });
  } catch (error) {
    console.error("Force Delete Error:", error);
    res.status(500).json({ error: 'Failed to delete asset permanently' });
  }
};

// 4. DELETE /assets/trash/empty - Empty Trash
export const emptyTrash = async (req: Request, res: Response) => {
  try {
    const assets = await prisma.asset.findMany({ where: { NOT: { deletedAt: null } } });

    // Delete all files
    assets.forEach(asset => {
        const filePath = path.join(process.cwd(), 'uploads', asset.filename);
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch {}
        
        if (asset.thumbnailPath) {
             const thumbPath = path.join(process.cwd(), 'uploads', asset.thumbnailPath);
             if (fs.existsSync(thumbPath)) try { fs.unlinkSync(thumbPath); } catch {}
        }
    });

    // Clear DB
    await prisma.asset.deleteMany({ where: { NOT: { deletedAt: null } } });
    res.json({ message: 'Trash emptied' });
  } catch (error) {
    console.error("Empty Trash Error:", error);
    res.status(500).json({ error: 'Failed to empty trash' });
  }
};