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

  const { filename, path: tempPath, originalname, mimetype, size } = multerReq.file;
  
  try {
    const userId = multerReq.user?.id;
    const creativity = parseFloat(req.body.creativity || '0.2'); 
    const specificity = req.body.specificity || 'general';

    // 1. Generate Thumbnails (Locally)
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

    // 3. Upload THUMBNAIL to Supabase
    let cloudThumbnailPath = null;
    if (thumbnailRelativePath) {
       const localThumbPath = path.join(__dirname, '../../uploads/', thumbnailRelativePath);
       
       // Handle WebP thumbnails (created for GIFs)
       const isWebP = thumbnailRelativePath.endsWith('.webp');
       
       cloudThumbnailPath = await uploadToSupabase(
         localThumbPath,
         thumbnailRelativePath, 
         isWebP ? 'image/webp' : 'image/jpeg'
       );
       await fs.remove(localThumbPath);
    }

    // 4. Save to Database
    const asset = await prisma.asset.create({
      data: {
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
        path: cloudOriginalPath,
        thumbnailPath: cloudThumbnailPath,
        userId: userId,
        aiData: JSON.stringify({}), 
      },
    });

    // 5. Trigger AI (SYNCHRONOUS WAIT)
    // We wait here so the user doesn't get redirected until tags are ready.
    const aiOptions = { creativity, specificity };
    
    try {
        console.log(`🤖 Starting AI Analysis for ${asset.id} (${mimetype})...`);
        
        // GIF Routing Logic
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
        // We catch here so the upload still succeeds even if AI fails
    } finally {
        // Safe Cleanup: Add slight delay for FFmpeg file locks on Windows
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`🧹 Cleaning up temp file: ${tempPath}`);
        await fs.remove(tempPath).catch(e => console.error("Cleanup error:", e));
    }

    // 6. Return Success (Only AFTER AI is done)
    res.status(201).json({
      message: 'Asset uploaded and analyzed successfully',
      asset,
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

// --- GET ASSETS (Search Engine V2.5) ---
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, color } = req.query;
    const cleanSearch = String(search || '').trim().toLowerCase();
    
    const scoredMap = new Map<string, { asset: any, score: number, debug: string }>();

    // 1. SMART EXPANSION
    let searchTerms: string[] = [];
    if (cleanSearch) {
        const stemmer = natural.PorterStemmer;
        const stem = stemmer.stem(cleanSearch);
        
        const shouldExpand = cleanSearch.length > 2 && cleanSearch.length < 6 && !cleanSearch.includes(' ');

        if (shouldExpand) {
            const expanded = await expandQuery(cleanSearch);
            searchTerms = [...new Set([cleanSearch, stem, ...expanded])];
        } else {
            searchTerms = [cleanSearch, stem];
        }
    }

    // 2. VECTOR SEARCH
    if (cleanSearch.length > 2) {
      try {
        const embedding = await generateEmbedding(cleanSearch);
        if (embedding) {
          const vectorString = `[${embedding.join(',')}]`;
          
          const rawVectorAssets: any[] = await prisma.$queryRaw`
            SELECT id, (embedding <=> ${vectorString}::vector) as distance
            FROM "Asset"
            WHERE 1=1
            ${type && type !== 'all' ? Prisma.sql`AND "mimeType" LIKE ${type === 'image' ? 'image/%' : type === 'video' ? 'video/%' : '%pdf%'}` : Prisma.empty}
            ${color ? Prisma.sql`AND "aiData" ILIKE ${'%' + color + '%'}` : Prisma.empty}
            AND embedding IS NOT NULL
            ORDER BY distance ASC
            LIMIT 50;
          `;

          if (rawVectorAssets.length > 0) {
             const ids = rawVectorAssets.map(a => a.id);
             const vectorAssets = await prisma.asset.findMany({
               where: { id: { in: ids } },
               include: { uploadedBy: { select: { name: true } } },
             });

             vectorAssets.forEach(asset => {
                const match = rawVectorAssets.find(r => r.id === asset.id);
                const distance = match?.distance || 1;
                
                if (distance < 0.40) { 
                    const semanticScore = 50 * Math.exp(-5 * distance);
                    scoredMap.set(asset.id, { asset, score: semanticScore, debug: `Vector (${distance.toFixed(3)})` });
                }
             });
          }
        }
      } catch (err) { console.warn("Vector search failed", err); }
    }

    // 3. KEYWORD SEARCH
    const keywordWhere: any = { AND: [] };
    
    if (type && type !== 'all') {
      if (type === 'image') keywordWhere.AND.push({ mimeType: { startsWith: 'image/' } });
      else if (type === 'video') keywordWhere.AND.push({ mimeType: { startsWith: 'video/' } });
      else if (type === 'document') keywordWhere.AND.push({ mimeType: 'application/pdf' }); 
    }
    if (color) {
        keywordWhere.AND.push({ aiData: { contains: String(color), mode: 'insensitive' } });
    }

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
      take: 100,
    });

    // 4. SCORING
    keywordAssets.forEach(asset => {
        let score = 0;
        const lowerName = asset.originalName.toLowerCase();
        const lowerAI = (asset.aiData || '').toLowerCase();
        const nameWithoutExt = lowerName.replace(/\.[^/.]+$/, "");

        if (nameWithoutExt === cleanSearch) score += 100;
        else if (nameWithoutExt.startsWith(cleanSearch)) score += 70;
        else if (nameWithoutExt.includes(cleanSearch)) score += 40;

        if (lowerAI.includes(cleanSearch)) score += 30;

        const daysOld = (Date.now() - new Date(asset.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld < 30) score += 10 * (1 - daysOld / 30);

        if (scoredMap.has(asset.id)) {
            const existing = scoredMap.get(asset.id)!;
            scoredMap.set(asset.id, { 
                asset, 
                score: existing.score + score, 
                debug: existing.debug + ` + Keyword (${score.toFixed(0)})` 
            });
        } else {
            scoredMap.set(asset.id, { asset, score, debug: `Keyword (${score.toFixed(0)})` });
        }
    });

    // 5. CLICK BOOST
    if (cleanSearch) {
        const clickCounts = await prisma.assetClick.groupBy({
            by: ['assetId'],
            where: { query: cleanSearch },
            _count: true
        });
        
        clickCounts.forEach(c => {
            if (scoredMap.has(c.assetId)) {
                const entry = scoredMap.get(c.assetId)!;
                const boost = Math.log10(c._count + 1) * 10;
                entry.score += boost;
            }
        });
    }

    // 6. SORT & RETURN
    let finalResults = Array.from(scoredMap.values())
        .sort((a, b) => b.score - a.score)
        .map(item => item.asset);

    if (cleanSearch) {
        await prisma.searchLog.create({
            data: {
                query: cleanSearch,
                resultCount: finalResults.length,
                userId: (req as any).user?.id || null
            }
        }).catch(e => {});
    }

    if (finalResults.length === 0 && cleanSearch) {
        const fallbackAssets = await prisma.asset.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { uploadedBy: { select: { name: true } } }
        });
        res.json({ results: fallbackAssets, isFallback: true });
        return;
    }

    res.json(finalResults);

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

// 7. UPDATE CATEGORY (Rename or Change Cover)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;
  const { id } = req.params;
  const { name, group } = req.body;

  try {
    let coverImagePath = undefined;

    // Handle File Upload if present
    if (multerReq.file) {
        const { path: tempPath, filename, mimetype } = multerReq.file;
        
        // Upload to Supabase (Categories folder)
        coverImagePath = await uploadToSupabase(
            tempPath,
            `categories/${filename}`,
            mimetype
        );
        
        // Cleanup local file
        await fs.remove(tempPath);
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(group && { group }),
        ...(coverImagePath && { coverImage: coverImagePath }) // Only update if new file
      }
    });

    res.json(category);
  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(500).json({ message: 'Failed to update category' });
  }
};