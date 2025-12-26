import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import path from 'path';
import fs from 'fs-extra';

// Import Storage Services
import { 
  uploadToSupabase, 
  deleteFromSupabase 
} from '../services/storage.service';

// Import Image Services
import { 
  generateThumbnail, 
  generateVideoThumbnail, 
  generatePdfThumbnail,
  generateVideoPreviews // ✅ Required for scrubbing
} from '../services/image.service';

// Import AI Services
import { 
  analyzeImage, 
  analyzePdf, 
  analyzeAudioVideo 
} from '../services/ai.service';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: any;
}

// ==========================================
// 1. UPLOAD ASSET (Synchronous Wait for AI)
// ==========================================
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

    // A. Capture User Inputs
    const finalOriginalName = req.body.originalName || multerOriginalName;
    
    let initialAiData = {};
    if (req.body.aiData) {
        try {
            initialAiData = JSON.parse(req.body.aiData); 
        } catch (e) {
            console.warn("Could not parse frontend aiData");
        }
    }

    // B. Setup Local Thumbnail Directory
    const thumbnailDir = path.join(__dirname, '../../uploads/thumbnails');
    await fs.ensureDir(thumbnailDir);
    
    let thumbnailRelativePath = null;
    let previewFrames: string[] = []; // ✅ Store 10 frame URLs here

    // C. Generate Thumbnails & Previews (Locally)
    try {
      if (mimetype.startsWith('image/')) {
         thumbnailRelativePath = await generateThumbnail(tempPath, thumbnailDir);
      } 
      else if (mimetype.startsWith('video/')) {
         // 1. Main Thumbnail
         thumbnailRelativePath = await generateVideoThumbnail(tempPath, thumbnailDir);

         // 2. ✅ Generate 10 Scrubbing Previews
         try {
             // Generate local files (e.g., vid-scrub-1.jpg ... vid-scrub-10.jpg)
             const previewFiles = await generateVideoPreviews(tempPath, thumbnailDir, filename);
             
             // Upload each frame to Supabase immediately
             for (const pFile of previewFiles) {
                 const localPPath = path.join(thumbnailDir, pFile);
                 const cloudPPath = await uploadToSupabase(
                     localPPath, 
                     `previews/${pFile}`, 
                     'image/jpeg'
                 );
                 previewFrames.push(cloudPPath);
                 await fs.remove(localPPath); // Cleanup local frame
             }
         } catch (videoError) {
             console.warn("Video preview generation failed:", videoError);
         }
      }
      else if (mimetype === 'application/pdf') {
         thumbnailRelativePath = await generatePdfThumbnail(tempPath, thumbnailDir);
      }
    } catch (thumbError) {
      console.warn("Thumbnail generation failed:", thumbError);
      thumbnailRelativePath = null;
    }

    // D. Upload ORIGINAL to Supabase
    const cloudOriginalPath = await uploadToSupabase(
      tempPath, 
      `originals/${filename}`, 
      mimetype
    );

    // E. Upload THUMBNAIL to Supabase
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
    
    // F. Save to Database
    const asset = await prisma.asset.create({
      data: {
        filename,
        originalName: finalOriginalName,
        mimeType: mimetype,
        size,
        path: cloudOriginalPath,
        thumbnailPath: cloudThumbnailPath,
        previewFrames: previewFrames, // ✅ Save the frames array
        userId: userId!, 
        aiData: JSON.stringify(initialAiData),
      },
    });

    // G. Trigger AI Analysis
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

    // H. Merge AI Data back into DB record (if frontend provided some)
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
    // Emergency Cleanup
    if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath).catch(() => {});
    }
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error processing upload' });
  }
};

// ==========================================
// 2. TRACK CLICKS (Analytics)
// ==========================================
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

// ==========================================
// 3. GET ASSETS (Optimized V5.0) - with Soft Delete Support
// ==========================================
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, color, page = 1, limit = 50 } = req.query;
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit))); 
    const skip = (pageNum - 1) * limitNum;

    const cleanSearch = String(search || '').trim().toLowerCase();
    
    // A. Reusable Filter Logic
    const buildFilters = () => {
        const filters: any = {
            // ✅ CRITICAL: Only show assets that are NOT in the trash
            deletedAt: null
        };

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

    // B. Lightweight Select (Include previewFrames)
    const lightweightSelect = {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        path: true,
        thumbnailPath: true,
        previewFrames: true, // ✅ Return frames to frontend
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
                select: lightweightSelect, 
            })
        ]);

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

    // Ensure activeFilters (including deletedAt: null) are applied to search
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

    // Fetch Candidates
    const keywordAssets = await prisma.asset.findMany({
      where: keywordWhere,
      select: lightweightSelect, 
      take: 200, 
    });

    // Score Candidates
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

    const totalSearch = finalResults.length;
    const paginatedResults = finalResults.slice(skip, skip + limitNum);

    // --- MODE C: FALLBACK ---
    let isFallback = false;
    if (paginatedResults.length === 0 && pageNum === 1) {
        isFallback = true;
        const fallbackAssets = await prisma.asset.findMany({
            where: activeFilters, // Still ensures deletedAt: null
            orderBy: { createdAt: 'desc' },
            take: limitNum,
            select: lightweightSelect
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

// ==========================================
// 4. GET SINGLE ASSET
// ==========================================
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

// ==========================================
// 5. GET RELATED ASSETS (Recommendations)
// ==========================================
export const getRelatedAssets = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const targetAsset = await prisma.asset.findUnique({
            where: { id },
            select: { id: true, originalName: true, aiData: true, mimeType: true }
        });

        if (!targetAsset) {
            res.json([]);
            return;
        }

        let typeFilter: any = {};
        if (targetAsset.mimeType.startsWith('image/')) {
            typeFilter = { mimeType: { startsWith: 'image/' } };
        } else if (targetAsset.mimeType.startsWith('video/')) {
            typeFilter = { mimeType: { startsWith: 'video/' } };
        } else if (targetAsset.mimeType === 'application/pdf') {
            typeFilter = { mimeType: 'application/pdf' };
        }

        const stopWords = new Set(['image', 'img', 'pic', 'picture', 'photo', 'screenshot', 'screen', 'shot', 'copy', 'final', 'draft', 'upload', 'new', 'old', 'backup', 'ds', 'store', 'frame', 'rectangle', 'group', 'vector', 'untitled', 'design', 'migration', 'import', 'jpg', 'png', 'mp4']);
        
        const rawName = targetAsset.originalName || '';
        const nameKeywords = rawName.split(/[\s_\-\.\/]+/).map(w => w.toLowerCase()).filter(w => w.length > 3 && !/^\d+$/.test(w) && !stopWords.has(w));
        
        let tagKeywords: string[] = [];
        try {
            const parsed = JSON.parse(targetAsset.aiData || '{}');
            if (Array.isArray(parsed.tags)) tagKeywords = parsed.tags;
            if (typeof parsed.keywords === 'string') tagKeywords = parsed.keywords.split(',');
        } catch (e) {}

        const searchTerms = [...new Set([...tagKeywords, ...nameKeywords])].slice(0, 10);

        // Fallback: Recent items of same type
        if (searchTerms.length === 0) {
            const recent = await prisma.asset.findMany({
                where: { id: { not: id }, ...typeFilter },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { id: true, filename: true, originalName: true, mimeType: true, thumbnailPath: true, aiData: true, previewFrames: true } 
            });
            res.json(recent);
            return;
        }

        // Search Candidates
        const candidates = await prisma.asset.findMany({
            where: { 
                id: { not: id }, 
                ...typeFilter, 
                OR: [ 
                    ...searchTerms.map(t => ({ originalName: { contains: t, mode: Prisma.QueryMode.insensitive } })), 
                    ...searchTerms.map(t => ({ aiData: { contains: t, mode: Prisma.QueryMode.insensitive } })) 
                ] 
            },
            take: 100,
            select: { id: true, filename: true, originalName: true, mimeType: true, thumbnailPath: true, aiData: true, previewFrames: true } 
        });

        // Score Candidates
        const scoredAssets = candidates.map(asset => {
            let score = 0;
            const lowerName = (asset.originalName || '').toLowerCase();
            const lowerAI = (String(asset.aiData) || '').toLowerCase();
            searchTerms.forEach(term => {
                const lowerTerm = term.toLowerCase();
                if (lowerName.includes(lowerTerm)) score += 50;
                if (lowerAI.includes(lowerTerm)) score += 30;
                if (lowerName === lowerTerm) score += 50;
            });
            return { asset, score };
        });

        const finalResults = scoredAssets.filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 20).map(item => item.asset);

        // Fallback if scoring returned nothing
        if (finalResults.length === 0) {
            const recent = await prisma.asset.findMany({
                where: { id: { not: id }, ...typeFilter },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { id: true, filename: true, originalName: true, mimeType: true, thumbnailPath: true, aiData: true, previewFrames: true }
            });
            res.json(recent);
            return;
        }
        res.json(finalResults);

    } catch (error) {
        console.error("Related Error:", error);
        res.status(500).json({ message: 'Error' });
    }
};

// ==========================================
// 6. UPDATE ASSET
// ==========================================
export const updateAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { originalName, aiData } = req.body;
    const asset = await prisma.asset.update({
      where: { id },
      data: { originalName, aiData: typeof aiData === 'object' ? JSON.stringify(aiData) : aiData },
    });
    res.json(asset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating asset' });
  }
};

// ==========================================
// 7. DELETE ASSET (Soft Delete / Move to Trash)
// ==========================================
export const deleteAsset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    console.log(`\n🗑️ [SOFT DELETE] Moving Asset ID to Trash: ${id}`);

    // 1. Find the Asset
    const asset = await prisma.asset.findUnique({ where: { id } });
    
    if (!asset) {
        res.status(404).json({ message: 'Asset not found' });
        return;
    }

    // 2. Permission Check (Owner or Admin)
    if (userRole !== 'admin' && asset.userId !== userId) {
        res.status(403).json({ message: 'Access denied' });
        return;
    }

    // 3. Perform Soft Delete (Update deletedAt)
    // We DO NOT delete files or relations yet. That happens in forceDelete.
    await prisma.asset.update({
        where: { id },
        data: { deletedAt: new Date() }
    });
    
    res.json({ message: 'Asset moved to recycle bin' });

  } catch (error) {
    console.error("🔥 SOFT DELETE ERROR:", error);
    res.status(500).json({ message: 'Server error', error: String(error) });
  }
};