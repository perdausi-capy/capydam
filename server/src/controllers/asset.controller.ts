import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
// import { generateEmbedding, expandQuery } from '../services/ai.service';
// import natural from 'natural';
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
       const isWebP = thumbnailRelativePath.endsWith('.webp');
       
       cloudThumbnailPath = await uploadToSupabase(
         localThumbPath,
         thumbnailRelativePath, 
         isWebP ? 'image/webp' : 'image/jpeg'
       );
       await fs.remove(localThumbPath);
    }
    
    // 5. Initial Save to Database
    const asset = await prisma.asset.create({
      data: {
        filename,
        originalName: finalOriginalName,
        mimeType: mimetype,
        size,
        path: cloudOriginalPath,
        thumbnailPath: cloudThumbnailPath,
        userId: userId!, 
        aiData: JSON.stringify(initialAiData),
      },
    });

    // 6. Trigger AI Analysis
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
        await new Promise(resolve => setTimeout(resolve, 500));
        await fs.remove(tempPath).catch(e => console.error("Cleanup error:", e));
    }

    // 7. SAFETY RESTORE: Merge User Link
    let finalAsset = await prisma.asset.findUnique({ where: { id: asset.id } });

    if (req.body.aiData && finalAsset) {
        const currentAiData = finalAsset.aiData ? JSON.parse(finalAsset.aiData) : {};
        const mergedAiData = {
            ...currentAiData,
            ...initialAiData
        };

        finalAsset = await prisma.asset.update({
            where: { id: asset.id },
            data: { aiData: JSON.stringify(mergedAiData) }
        });
    }

    res.status(201).json({
      message: 'Asset uploaded and analyzed successfully',
      asset: finalAsset || asset,
    });

  } catch (error) {
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

// --- GET ASSETS (Optimized V5.0) ---
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, color, page = 1, limit = 50 } = req.query;
    
    // Parse pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit))); // Cap at 100
    const skip = (pageNum - 1) * limitNum;

    const cleanSearch = String(search || '').trim().toLowerCase();
    
    // 1. REUSABLE FILTER LOGIC
    const buildFilters = () => {
        const filters: any = {};
        if (type && type !== 'all') {
            if (type === 'image') filters.mimeType = { startsWith: 'image/' };
            else if (type === 'video') filters.mimeType = { startsWith: 'video/' };
            else if (type === 'document') filters.mimeType = 'application/pdf';
        }
        if (color) {
            filters.aiData = { contains: String(color), mode: 'insensitive' };
        }
        return filters;
    };

    const activeFilters = buildFilters();

    // 2. LIGHTWEIGHT SELECT (Crucial for Speed)
    // We strictly exclude 'embedding' and big unused fields
    const lightweightSelect = {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        path: true,
        thumbnailPath: true,
        aiData: true, 
        uploadedBy: { select: { name: true } }
    };

    // --- MODE A: BROWSE (No Text Search) ---
    if (!cleanSearch) {
        const [total, assets] = await Promise.all([
            prisma.asset.count({ where: activeFilters }),
            prisma.asset.findMany({
                where: activeFilters,
                orderBy: { createdAt: 'desc' },
                take: limitNum,
                skip: skip,
                select: lightweightSelect, // ⚡ Optimization
            })
        ]);

        // Fix Thumbnail paths if missing
        const fixedAssets = assets.map(asset => ({
            ...asset,
            thumbnailPath: asset.thumbnailPath || asset.path 
        }));

        res.json({
            results: fixedAssets,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum)
        });
        return;
    }

    // --- MODE B: SEARCH (Optimized) ---
    const scoredMap = new Map<string, { asset: any, score: number }>();

    let searchTerms: string[] = [cleanSearch];
    // (Optional: add expansion logic here if needed)

    const keywordWhere: any = { 
        AND: [ activeFilters ] 
    };

    if (searchTerms.length > 0) {
      keywordWhere.AND.push({
        OR: searchTerms.flatMap(term => [
          { originalName: { contains: term, mode: 'insensitive' } },
          { aiData: { contains: term, mode: 'insensitive' } },
        ])
      });
    }

    // Fetch potential matches (Limit 200 to save RAM)
    const keywordAssets = await prisma.asset.findMany({
      where: keywordWhere,
      select: lightweightSelect, // ⚡ Optimization
      take: 200, 
    });

    keywordAssets.forEach(asset => {
        let score = 0;
        const lowerName = (asset.originalName || '').toLowerCase();
        const lowerAI = (String(asset.aiData) || '').toLowerCase();
        
        if (lowerName === cleanSearch) score += 100;
        else if (lowerName.includes(cleanSearch)) score += 50;
        if (lowerAI.includes(cleanSearch)) score += 30;

        scoredMap.set(asset.id, { asset, score });
    });

    let finalResults = Array.from(scoredMap.values())
        .sort((a, b) => b.score - a.score)
        .map(item => item.asset);

    // Manual Pagination for Search Results
    const totalSearch = finalResults.length;
    const paginatedResults = finalResults.slice(skip, skip + limitNum);

    // --- MODE C: FALLBACK ---
    let isFallback = false;
    if (paginatedResults.length === 0 && pageNum === 1) {
        isFallback = true;
        const fallbackAssets = await prisma.asset.findMany({
            where: activeFilters,
            orderBy: { createdAt: 'desc' },
            take: limitNum,
            select: lightweightSelect // ⚡ Optimization
        });
        
        const fixedFallback = fallbackAssets.map(asset => ({
            ...asset,
            thumbnailPath: asset.thumbnailPath || asset.path 
        }));
        
        res.json({ results: fixedFallback, isFallback: true, total: 0, page: 1, totalPages: 1 });
        return;
    }

    const fixedResults = paginatedResults.map(asset => ({
        ...asset,
        thumbnailPath: asset.thumbnailPath || asset.path 
    }));

    res.json({ 
        results: fixedResults, 
        isFallback,
        total: totalSearch,
        page: pageNum,
        totalPages: Math.ceil(totalSearch / limitNum)
    });

  } catch (error) {
    console.error("Get Assets Error:", error);
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

// --- RECOMMENDATIONS (Fixed for Migrated Assets) ---
export const getRelatedAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    console.log(`\n🔍 [Debug] Finding related assets for: ${id}`);

    // 1. Try Vector Search (For AI Assets)
    const targetAsset: any = await prisma.$queryRaw`
      SELECT embedding::text FROM "Asset" WHERE id = ${id}
    `;

    // A. Use Vector Search if embedding exists
    if (targetAsset && targetAsset.length > 0 && targetAsset[0].embedding) {
        console.log("   ✅ Using AI Vector Search");
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
        
        if ((relatedAssets as any[]).length > 0) {
            res.json(relatedAssets);
            return;
        }
    }

    // ---------------------------------------------------------
    // B. Text Fallback (For Migrated Assets)
    // ---------------------------------------------------------
    console.log("   ⚠️ No embedding or no results. Using Text Fallback.");
    
    const currentAsset = await prisma.asset.findUnique({
        where: { id },
        select: { originalName: true, aiData: true }
    });

    if (!currentAsset) {
        res.json([]);
        return;
    }

    // 1. Better Keyword Extraction (Handles 'migration/photo.jpg')
    const rawName = currentAsset.originalName || '';
    const nameKeywords = rawName
        .split(/[\s_\-\.\/]+/) // 👈 Added '/' to split path like "migration/file.jpg"
        .filter(w => w.length > 3 && isNaN(Number(w)) && w !== 'migration'); // Filter 'migration' keyword

    // 2. Extract Tags
    let tagKeywords: string[] = [];
    try {
        const parsed = JSON.parse(currentAsset.aiData || '{}');
        if (Array.isArray(parsed.tags)) tagKeywords = parsed.tags;
        if (typeof parsed.keywords === 'string') tagKeywords = parsed.keywords.split(',');
    } catch (e) {}

    const searchTerms = [...new Set([...nameKeywords, ...tagKeywords])].slice(0, 8);
    console.log("   🔎 Search Terms:", searchTerms);

    // 3. Perform Text Search
    if (searchTerms.length > 0) {
        const relatedByText = await prisma.asset.findMany({
            where: {
                id: { not: id },
                OR: [
                    ...searchTerms.map(t => ({ originalName: { contains: t, mode: Prisma.QueryMode.insensitive } })),
                    ...searchTerms.map(t => ({ aiData: { contains: t, mode: Prisma.QueryMode.insensitive } }))
                ]
            },
            take: 20,
            select: { id: true, filename: true, originalName: true, mimeType: true, thumbnailPath: true, aiData: true }
        });

        if (relatedByText.length > 0) {
            console.log(`   ✅ Found ${relatedByText.length} matches via text.`);
            res.json(relatedByText);
            return;
        }
    }

    // ---------------------------------------------------------
    // C. "Last Resort" Fallback (Recent Uploads)
    // ---------------------------------------------------------
    console.log("   ⚠️ No text matches. Showing recent assets.");
    
    const recentAssets = await prisma.asset.findMany({
        where: { id: { not: id } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, filename: true, originalName: true, mimeType: true, thumbnailPath: true, aiData: true }
    });

    res.json(recentAssets);

  } catch (error) {
    console.error("Related Error:", error);
    res.status(500).json({ message: 'Error' });
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
    if (asset.path) await deleteFromSupabase(asset.path);
    if (asset.thumbnailPath) await deleteFromSupabase(asset.thumbnailPath);

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error deleting asset' });
  }
};