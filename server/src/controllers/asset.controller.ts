import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs-extra';

// Import Image Services
import { 
  generateThumbnail, 
  generateVideoThumbnail, 
  generatePdfThumbnail 
} from '../services/image.service';

// Import AI Services
import { 
  analyzeImage, 
  analyzePdf, 
  analyzeAudioVideo 
} from '../services/ai.service';

// Extend Express Request to include Multer file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: any; // Populated by verifyJWT middleware
}

export const uploadAsset = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;

  if (!multerReq.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  try {
    const { filename, path: tempPath, originalname, mimetype, size } = multerReq.file;
    const userId = multerReq.user?.id;
    
    // --- READ BODY PARAMS ---
    const creativity = parseFloat(req.body.creativity || '0.2'); 
    const specificity = req.body.specificity || 'general';

    // --- THUMBNAIL GENERATION ---
    const thumbnailDir = path.join(__dirname, '../../uploads/thumbnails');
    await fs.ensureDir(thumbnailDir);
    
    let thumbnailRelativePath = null;

    try {
      if (mimetype.startsWith('image/')) {
         thumbnailRelativePath = await generateThumbnail(tempPath, thumbnailDir);
      } 
      else if (mimetype.startsWith('video/')) {
         // ✅ Now generates real screenshots for videos!
         thumbnailRelativePath = await generateVideoThumbnail(tempPath, thumbnailDir);
      }
      else if (mimetype === 'application/pdf') {
         // Returns null for now (Icon mode)
         thumbnailRelativePath = await generatePdfThumbnail(tempPath, thumbnailDir);
      }
    } catch (thumbError) {
      console.warn("Thumbnail generation failed, falling back to icon:", thumbError);
      thumbnailRelativePath = null;
    }

    // --- SAVE TO DB ---
    const asset = await prisma.asset.create({
      data: {
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
        path: `uploads/${filename}`, 
        thumbnailPath: thumbnailRelativePath,
        userId: userId,
        aiData: JSON.stringify({}), 
      },
    });

    // --- AI ANALYSIS (Background Process) ---
    // We do NOT await this, so the user gets a fast response
    const absolutePath = path.join(__dirname, '../../', asset.path);
    const aiOptions = { creativity, specificity };

    if (mimetype.startsWith('image/')) {
      analyzeImage(asset.id, absolutePath, aiOptions);
    } 
    else if (mimetype === 'application/pdf') {
      analyzePdf(asset.id, absolutePath, aiOptions);
    }
    // Supports Audio AND Video
    else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
      analyzeAudioVideo(asset.id, absolutePath, aiOptions);
    }

    res.status(201).json({
      message: 'Asset uploaded successfully',
      asset,
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error processing upload' });
  }
};

export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type } = req.query;

    // Build the WHERE clause dynamically
    const whereClause: any = {
      AND: [],
    };

    // 1. Handle Search Text
    if (search) {
      whereClause.AND.push({
        OR: [
          { originalName: { contains: String(search) } },
          { aiData: { contains: String(search) } },
        ],
      });
    }

    // 2. Handle File Type Filter
    if (type && type !== 'all') {
      if (type === 'image') {
        whereClause.AND.push({ mimeType: { startsWith: 'image/' } });
      } else if (type === 'video') {
        whereClause.AND.push({ mimeType: { startsWith: 'video/' } });
      } else if (type === 'document') {
        whereClause.AND.push({ mimeType: 'application/pdf' }); 
        // You can add OR conditions here later for .docx, .txt etc.
      }
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

export const updateAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { originalName, aiData } = req.body; // We expect the full JSON object for aiData

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        originalName,
        // If the frontend sends an object, we stringify it for SQLite
        aiData: typeof aiData === 'object' ? JSON.stringify(aiData) : aiData,
      },
    });

    res.json(asset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating asset' });
  }
};

// Ensure 'fs' and 'path' are imported at the top
// import fs from 'fs-extra'; 
// import path from 'path';

export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id; // From verifyJWT
    const userRole = (req as any).user?.role;

    // 1. Find the asset first
    const asset = await prisma.asset.findUnique({
      where: { id },
    });

    if (!asset) {
      res.status(404).json({ message: 'Asset not found' });
      return;
    }

    // 2. Ownership Check (Basic Security)
    // Only allow delete if: User is Admin OR User is the one who uploaded it
    if (userRole !== 'admin' && asset.userId !== userId) {
      res.status(403).json({ message: 'You do not have permission to delete this asset.' });
      return;
    }

    // 3. Delete from Database
    await prisma.asset.delete({
      where: { id },
    });

    // 4. Delete from Filesystem (Cleanup)
    try {
      // Construct absolute paths
      const originalPath = path.join(__dirname, '../../', asset.path);
      const thumbnailPath = asset.thumbnailPath 
        ? path.join(__dirname, '../../', asset.thumbnailPath) 
        : null;

      await fs.remove(originalPath);
      if (thumbnailPath) await fs.remove(thumbnailPath);
      
    } catch (fsError) {
      console.error('Error deleting files from disk:', fsError);
      // We continue even if FS fails, because the DB record is gone.
    }

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting asset' });
  }
};