import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { generateEmbedding, expandQuery } from '../services/ai.service';
import natural from 'natural';
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

// --- UPLOAD (Synchronous: Waits for AI) ---
export const uploadAsset = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;

  if (!multerReq.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  const { filename, path: tempPath, originalname: multerOriginalName, mimetype, size } = multerReq.file;
  
  try {
    const userId = multerReq.user?.id;
    const creativity = parseFloat(req.body.creativity || '0.2'); 
    const specificity = req.body.specificity || 'general';

    // 1. Capture User Inputs (Name & Link)
    const finalOriginalName = req.body.originalName || multerOriginalName;
    
    let initialAiData = {};
    if (req.body.aiData) {
        try {
            // This contains { "externalLink": "..." } from the frontend
            initialAiData = JSON.parse(req.body.aiData); 
        } catch (e) {
            console.warn("Could not parse frontend aiData");
        }
    }

    // 2. Generate Thumbnails (Locally)
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

    // 3. Upload ORIGINAL to Supabase
    const cloudOriginalPath = await uploadToSupabase(
      tempPath, 
      `originals/${filename}`, 
      mimetype
    );

    // 4. Upload THUMBNAIL to Supabase
    let cloudThumbnailPath = null;
    if (thumbnailRelativePath) {
       const localThumbPath = path.join(__dirname, '../../uploads/', thumbnailRelativePath);
       
       // Detect if it's WebP (for GIFs) or JPEG
       const isWebP = thumbnailRelativePath.endsWith('.webp');
       
       cloudThumbnailPath = await uploadToSupabase(
         localThumbPath,
         thumbnailRelativePath, 
         isWebP ? 'image/webp' : 'image/jpeg'
       );
       await fs.remove(localThumbPath);
    }
    
    // 5. Initial Save to Database
    // We save the user's link here immediately.
    const asset = await prisma.asset.create({
      data: {
        filename,
        originalName: finalOriginalName,
        mimeType: mimetype,
        size,
        path: cloudOriginalPath,
        thumbnailPath: cloudThumbnailPath,
        userId: userId!, 
        aiData: JSON.stringify(initialAiData), // ✅ Stores { externalLink: ... }
      },
    });

    // 6. Trigger AI Analysis (Synchronous Wait)
    const aiOptions = { creativity, specificity };
    
    try {
        console.log(`🤖 Starting AI Analysis for ${asset.id} (${mimetype})...`);
        
        if (mimetype === 'image/gif') {
            await analyzeAudioVideo(asset.id, tempPath, aiOptions);
        } 
        else if (mimetype.startsWith('image/')) {
            await analyzeImage(asset.id, tempPath, aiOptions);
        } 
        else if (mimetype === 'application/pdf') {
            await analyzePdf(asset.id, tempPath, aiOptions);
        }
        else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
            await analyzeAudioVideo(asset.id, tempPath, aiOptions);
        }
        console.log(`✅ AI Analysis Finished for ${asset.id}`);
        
    } catch (err) {
        console.error("AI Analysis Warning (continuing):", err);
    } finally {
        // Cleanup temp file
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay for file locks
        console.log(`🧹 Cleaning up temp file: ${tempPath}`);
        await fs.remove(tempPath).catch(e => console.error("Cleanup error:", e));
    }

    // 7. SAFETY RESTORE: Ensure the Link persists
    // The AI process above might have done `prisma.asset.update` with new tags,
    // potentially overwriting our `aiData` JSON. We must check and merge.
    
    let finalAsset = await prisma.asset.findUnique({ where: { id: asset.id } });

    // Only run this merge logic if the user actually provided a link
    if (req.body.aiData && finalAsset) {
        const currentAiData = finalAsset.aiData ? JSON.parse(finalAsset.aiData) : {};
        
        // Merge: Keep the new AI tags + Force the User Link back in
        const mergedAiData = {
            ...currentAiData,
            ...initialAiData // This ensures { externalLink: "..." } wins
        };

        // Write the merged data back to DB
        finalAsset = await prisma.asset.update({
            where: { id: asset.id },
            data: { aiData: JSON.stringify(mergedAiData) }
        });
        console.log("🔗 User Link restored/merged into AI Data.");
    }

    // 8. Return Success
    res.status(201).json({
      message: 'Asset uploaded and analyzed successfully',
      asset: finalAsset || asset,
    });

  } catch (error) {
    // Cleanup if critical error
    if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath).catch(() => {});
    }
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error processing upload' });
  }
};

// --- TRACK CLICKS ---
export const trackAssetClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetId, query, position } = req.body;
    const userId = (req as any).user?.id;

    await prisma.assetClick.create({
      data: { assetId, query: query || '', position, userId }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// --- GET ASSETS (Search Engine V4.0 - Strict Filters) ---
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, color } = req.query;
    const cleanSearch = String(search || '').trim().toLowerCase();
    
    // 1. REUSABLE FILTER LOGIC
    // We define this once so it applies to Browse, Search, AND Fallback
    const buildFilters = () => {
        const filters: any = {};
        
        // Type Filter
        if (type && type !== 'all') {
            if (type === 'image') filters.mimeType = { startsWith: 'image/' };
            else if (type === 'video') filters.mimeType = { startsWith: 'video/' };
            else if (type === 'document') filters.mimeType = 'application/pdf';
        }

        // Color Filter
        if (color) {
            filters.aiData = { contains: String(color), mode: 'insensitive' };
        }
        return filters;
    };

    const activeFilters = buildFilters();

    // --- MODE A: BROWSE (No Text Search) ---
    if (!cleanSearch) {
        const assets = await prisma.asset.findMany({
            where: activeFilters, // ✅ Applies filters correctly
            orderBy: { createdAt: 'desc' },
            take: 2000, 
            include: { uploadedBy: { select: { name: true } } }
        });

        // Server-side Thumbnail Patch
        const fixedAssets = assets.map(asset => ({
            ...asset,
            thumbnailPath: asset.thumbnailPath || asset.path 
        }));

        res.json(fixedAssets);
        return;
    }

    // --- MODE B: SEARCH ---
    const scoredMap = new Map<string, { asset: any, score: number, debug: string }>();

    // 1. Expansion
    let searchTerms: string[] = [];
    const stemmer = natural.PorterStemmer;
    const stem = stemmer.stem(cleanSearch);
    if (cleanSearch.length > 2 && cleanSearch.length < 6 && !cleanSearch.includes(' ')) {
        const expanded = await expandQuery(cleanSearch);
        searchTerms = [...new Set([cleanSearch, stem, ...expanded])];
    } else {
        searchTerms = [cleanSearch, stem];
    }

    // 2. Keyword Search (Strict)
    const keywordWhere: any = { 
        AND: [
            activeFilters // ✅ Applies filters strict
        ] 
    };

    if (searchTerms.length > 0) {
      keywordWhere.AND.push({
        OR: searchTerms.flatMap(term => [
          { originalName: { contains: term, mode: 'insensitive' } },
          { aiData: { contains: term, mode: 'insensitive' } },
        ])
      });
    }

    const keywordAssets = await prisma.asset.findMany({
      where: keywordWhere,
      include: { uploadedBy: { select: { name: true } } },
      take: 500,
    });

    keywordAssets.forEach(asset => {
        let score = 0;
        const lowerName = asset.originalName.toLowerCase();
        const lowerAI = (asset.aiData || '').toLowerCase();
        
        if (lowerName === cleanSearch) score += 100;
        else if (lowerName.includes(cleanSearch)) score += 50;
        if (lowerAI.includes(cleanSearch)) score += 30;

        scoredMap.set(asset.id, { asset, score, debug: 'Keyword' });
    });

    let finalResults = Array.from(scoredMap.values())
        .sort((a, b) => b.score - a.score)
        .map(item => item.asset);

    // 3. FALLBACK WITH FILTERS
    if (finalResults.length === 0) {
        const fallbackAssets = await prisma.asset.findMany({
            where: activeFilters, // ✅ CRITICAL FIX: Fallback now respects filters!
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { uploadedBy: { select: { name: true } } }
        });

        const fixedFallback = fallbackAssets.map(asset => ({
            ...asset,
            thumbnailPath: asset.thumbnailPath || asset.path 
        }));
        
        res.json({ results: fixedFallback, isFallback: true });
        return;
    }

    const fixedResults = finalResults.map(asset => ({
        ...asset,
        thumbnailPath: asset.thumbnailPath || asset.path 
    }));

    res.json(fixedResults);

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

// --- RECOMMENDATIONS ---
export const getRelatedAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const targetAsset: any = await prisma.$queryRaw`
      SELECT embedding::text 
      FROM "Asset" 
      WHERE id = ${id}
    `;

    if (!targetAsset || targetAsset.length === 0 || !targetAsset[0].embedding) {
      res.json([]);
      return;
    }

    const vectorString = targetAsset[0].embedding;

    const relatedAssets = await prisma.$queryRaw`
      SELECT id, filename, "originalName", "mimeType", "thumbnailPath", "aiData"
      FROM "Asset"
      WHERE id != ${id}
      AND embedding IS NOT NULL
      AND (embedding <=> ${vectorString}::vector) < 0.60
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT 20;
    `;

    res.json(relatedAssets);
  } catch (error) {
    console.error("Error fetching related assets:", error);
    res.status(500).json({ message: 'Failed to fetch related assets' });
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

