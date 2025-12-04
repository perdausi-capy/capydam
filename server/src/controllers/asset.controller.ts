import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs-extra';

// Import Services
import { 
  uploadToSupabase, 
  deleteFromSupabase 
} from '../services/storage.service';

import { 
  generateThumbnail, 
  generateVideoThumbnail, 
  generatePdfThumbnail 
} from '../services/image.service';

import { 
  analyzeImage, 
  analyzePdf, 
  analyzeAudioVideo 
} from '../services/ai.service';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: any;
}

// --- UPLOAD ---
export const uploadAsset = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;

  if (!multerReq.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const { filename, path: tempPath, originalname, mimetype, size } = multerReq.file;
    const userId = multerReq.user?.id;
    
    const creativity = parseFloat(req.body.creativity || '0.2'); 
    const specificity = req.body.specificity || 'general';

    // 1. Generate Thumbnails (Locally first)
    const thumbnailDir = path.join(__dirname, '../../uploads/thumbnails');
    await fs.ensureDir(thumbnailDir);
    
    let thumbnailRelativePath = null;

    try {
      if (mimetype.startsWith('image/')) {
         thumbnailRelativePath = await generateThumbnail(tempPath, thumbnailDir);
      } 
      else if (mimetype.startsWith('video/')) {
         thumbnailRelativePath = await generateVideoThumbnail(tempPath, thumbnailDir);
      }
      else if (mimetype === 'application/pdf') {
         thumbnailRelativePath = await generatePdfThumbnail(tempPath, thumbnailDir);
      }
    } catch (thumbError) {
      console.warn("Thumbnail generation failed:", thumbError);
      thumbnailRelativePath = null;
    }

    // 2. Upload ORIGINAL to Supabase
    const cloudOriginalPath = await uploadToSupabase(
      tempPath, 
      `originals/${filename}`, 
      mimetype
    );

    // 3. Upload THUMBNAIL to Supabase (if exists)
    let cloudThumbnailPath = null;
    if (thumbnailRelativePath) {
       const localThumbPath = path.join(__dirname, '../../uploads/', thumbnailRelativePath);
       
       cloudThumbnailPath = await uploadToSupabase(
         localThumbPath,
         thumbnailRelativePath, 
         'image/jpeg'
       );
       
       // Cleanup Local Thumbnail
       await fs.remove(localThumbPath);
    }

    // 4. Save CLOUD URLS to Database
    const asset = await prisma.asset.create({
      data: {
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
        path: cloudOriginalPath, // <--- Supabase URL
        thumbnailPath: cloudThumbnailPath, // <--- Supabase URL
        userId: userId,
        aiData: JSON.stringify({}), 
      },
    });

    // 5. Trigger AI (Using local temp file before deleting it)
    const aiOptions = { creativity, specificity };
    
    // We pass the tempPath because the AI service reads from disk.
    // Ideally, update AI service to read from URL, but this works for now.
    if (mimetype.startsWith('image/')) {
      analyzeImage(asset.id, tempPath, aiOptions);
    } 
    else if (mimetype === 'application/pdf') {
      analyzePdf(asset.id, tempPath, aiOptions);
    }
    else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
      analyzeAudioVideo(asset.id, tempPath, aiOptions);
    }

    // 6. Cleanup Local Original File (Delayed slightly to let AI finish reading if async)
    // For absolute safety with async AI, you might await AI above, or move cleanup into AI service.
    // For MVP, we'll assume AI reads the buffer quickly.
    setTimeout(() => fs.remove(tempPath), 5000); 

    res.status(201).json({
      message: 'Asset uploaded successfully',
      asset,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error processing upload' });
  }
};

// --- GET ALL ---
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, color } = req.query;
    const whereClause: any = { AND: [] };

    if (search) {
      whereClause.AND.push({
        OR: [
          { originalName: { contains: String(search) } }, // Postgres is case-sensitive by default
          { aiData: { contains: String(search) } },
        ],
      });
    }

    if (type && type !== 'all') {
      if (type === 'image') whereClause.AND.push({ mimeType: { startsWith: 'image/' } });
      else if (type === 'video') whereClause.AND.push({ mimeType: { startsWith: 'video/' } });
      else if (type === 'document') whereClause.AND.push({ mimeType: 'application/pdf' }); 
    }

    if (color) {
      // The AI usually adds color names to 'tags' (e.g., "Red", "Blue")
      // OR we can search the 'colors' array string in the JSON
      whereClause.AND.push({
        aiData: { contains: String(color) } 
      });
    }

    const assets = await prisma.asset.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { name: true } } },
    });
    
    res.json(assets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching assets' });
  }
};

// --- GET ONE ---
export const getAssetById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: { uploadedBy: { select: { name: true, email: true } } },
    });

    if (!asset) {
      res.status(404).json({ message: 'Asset not found' });
      return;
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// --- UPDATE ---
export const updateAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { originalName, aiData } = req.body;

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        originalName,
        aiData: typeof aiData === 'object' ? JSON.stringify(aiData) : aiData,
      },
    });
    res.json(asset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating asset' });
  }
};

// --- DELETE ---
export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    const asset = await prisma.asset.findUnique({ where: { id } });

    if (!asset) {
      res.status(404).json({ message: 'Asset not found' });
      return;
    }

    if (userRole !== 'admin' && asset.userId !== userId) {
      res.status(403).json({ message: 'You do not have permission to delete this asset.' });
      return;
    }

    // 1. Delete from Database
    await prisma.asset.delete({ where: { id } });

    // 2. Delete from Supabase (Cloud)
    // We pass the Full URL, the service parses it
    if (asset.path) await deleteFromSupabase(asset.path);
    if (asset.thumbnailPath) await deleteFromSupabase(asset.thumbnailPath);

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting asset' });
  }
};