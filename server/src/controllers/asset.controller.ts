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

// --- UPLOAD ---
// --- UPLOAD ---
export const uploadAsset = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;

  if (!multerReq.file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  // Define paths early so we can use them in cleanup
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
       cloudThumbnailPath = await uploadToSupabase(
         localThumbPath,
         thumbnailRelativePath, 
         'image/jpeg'
       );
       await fs.remove(localThumbPath); // Delete thumbnail immediately
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

    // 5. TRIGGER AI (SYNCHRONOUS)
    // We await this so the response is only sent AFTER tags are generated.
    const aiOptions = { creativity, specificity };
    
    try {
        if (mimetype.startsWith('image/')) {
            await analyzeImage(asset.id, tempPath, aiOptions);
        } 
        else if (mimetype === 'application/pdf') {
            await analyzePdf(asset.id, tempPath, aiOptions);
        }
        else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
            await analyzeAudioVideo(asset.id, tempPath, aiOptions);
        }
    } catch (err) {
        console.error("AI Analysis Warning:", err);
        // We catch here so the upload still succeeds even if AI fails
    } finally {
        // ✅ SAFETY: Always clean up the temp file
        console.log(`🧹 Cleaning up temp file: ${tempPath}`);
        await fs.remove(tempPath).catch(e => console.error("Cleanup error:", e));
    }

    // 6. Return Success (Now guaranteed to have tags)
    res.status(201).json({
      message: 'Asset uploaded and analyzed successfully',
      asset,
    });

  } catch (error) {
    // If the main logic fails, ensure we still clean up the temp file
    if (await fs.pathExists(tempPath)) {
        await fs.remove(tempPath).catch(() => {});
    }
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error processing upload' });
  }
};

// --- NEW ENDPOINT: TRACK CLICKS ---
export const trackAssetClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetId, query, position } = req.body;
    const userId = (req as any).user?.id;

    await prisma.assetClick.create({
      data: { assetId, query: query || '', position, userId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Tracking error:", error);
    res.status(500).json({ success: false });
  }
};

// --- GET ALL ---
// ... imports (Prisma, generateEmbedding, etc)

// --- THE V2 SEARCH ENGINE ---
// --- SEARCH ENGINE V2.3 (Precision Mode) ---
export const getAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, color } = req.query;
    const rawSearch = String(search || '').trim().toLowerCase();
    
    // 1. PREPARE TOKENS
    let tokens: string[] = [];
    if (rawSearch) {
        // Clean: "Cat, Black!" -> "cat black"
        const clean = rawSearch.replace(/[^\w\s]/g, ''); 
        const words = clean.split(/\s+/).filter(w => w.length > 2); 
        
        // Stem: "wearing" -> "wear"
        const stemmer = natural.PorterStemmer;
        const stems = words.map(w => stemmer.stem(w));
        
        // Combine: ["wearing", "wear", "black"]
        tokens = [...new Set([...words, ...stems])];
        // console.log("🔍 Tokens:", tokens);
    }

    // 2. BASE FILTERS
    const baseFilters: any[] = [];
    if (type && type !== 'all') {
        const mimeStart = type === 'image' ? 'image/' : type === 'video' ? 'video/' : 'application/pdf';
        baseFilters.push({ mimeType: { startsWith: mimeStart } });
    }
    if (color) {
        // Strict Color Filter: Looks for the word in the JSON blob
        baseFilters.push({ aiData: { contains: String(color), mode: 'insensitive' } });
    }

    // 3. CANDIDATE FETCHING (Wide Net)
    // We grab anything that matches matching filters + AT LEAST ONE token
    let candidates: any[] = [];
    
    if (tokens.length > 0) {
        candidates = await prisma.asset.findMany({
            where: {
                AND: baseFilters,
                OR: [
                    // Broad match first, we filter strictly in JS
                    ...tokens.map(t => ({ originalName: { contains: t, mode: 'insensitive' as const } })),
                    ...tokens.map(t => ({ aiData: { contains: t, mode: 'insensitive' as const } }))
                ]
            },
            include: { uploadedBy: { select: { name: true } } },
            take: 200 
        });
    } else {
        // No search? Return recent
        candidates = await prisma.asset.findMany({
            where: { AND: baseFilters },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { uploadedBy: { select: { name: true } } }
        });
        res.json(candidates);
        return;
    }

    // 4. PRECISION SCORING ENGINE
    const scoredResults = candidates.map(asset => {
        let score = 0;
        let aiJson: any = {};
        try { aiJson = JSON.parse(asset.aiData || '{}'); } catch(e) {}

        const filename = (asset.originalName || '').toLowerCase();
        const tags = (aiJson.tags || []).map((t: string) => t.toLowerCase());
        const description = (aiJson.description || '').toLowerCase();
        const transcript = (aiJson.transcript || '').toLowerCase();

        // CHECK 1: EXACT PHRASE MATCH (The "Perfect" Match)
        // Does "cat wearing black" appear exactly?
        if (filename.includes(rawSearch)) score += 100;
        if (tags.some((t: string) => t === rawSearch)) score += 80;
        if (description.includes(rawSearch)) score += 50;

        // CHECK 2: TOKEN COVERAGE (The "Precision" Match)
        // If I searched 3 words, how many did we find?
        let tokensMatched = 0;
        tokens.forEach(token => {
            let found = false;
            
            // Priority A: Filename
            if (filename.includes(token)) { score += 20; found = true; }
            
            // Priority B: Tags (Specific Keywords)
            if (tags.some((t: string) => t.includes(token))) { score += 15; found = true; }
            
            // Priority C: Description/Transcript (General Text)
            if (description.includes(token) || transcript.includes(token)) { score += 5; found = true; }

            if (found) tokensMatched++;
        });

        // BONUSES
        // "All words found" Bonus (Huge boost for precision)
        if (tokensMatched === tokens.length && tokens.length > 0) score += 200;
        
        // "Most words found" Bonus
        else if (tokensMatched > (tokens.length * 0.7)) score += 50;

        return { asset, score, tokensMatched };
    });

    // 5. FILTER & SORT
    const finalResults = scoredResults
        .filter(item => item.score > 0) // Remove things with 0 relevance
        .sort((a, b) => b.score - a.score) // Highest score first
        .map(item => item.asset);

    // 6. VECTOR FALLBACK (Only if few results)
    // If strict text failed to find enough, we ask the AI for help
    if (finalResults.length < 5 && rawSearch.length > 2) {
        try {
            const embedding = await generateEmbedding(rawSearch);
            if (embedding) {
                const vectorString = `[${embedding.join(',')}]`;
                const rawVectorAssets: any[] = await prisma.$queryRaw`
                    SELECT id 
                    FROM "Asset" 
                    WHERE 1=1
                    ${color ? Prisma.sql`AND "aiData" ILIKE ${'%' + color + '%'}` : Prisma.empty}
                    AND embedding IS NOT NULL
                    -- Very strict vector threshold to ensure relevance
                    AND (embedding <=> ${vectorString}::vector) < 0.40
                    ORDER BY embedding <=> ${vectorString}::vector
                    LIMIT 10;
                `;
                
                // Fetch and append unique vector matches to the bottom
                const existingIds = new Set(finalResults.map(a => a.id));
                const newIds = rawVectorAssets.map(r => r.id).filter(id => !existingIds.has(id));
                
                if (newIds.length > 0) {
                    const vectorAssets = await prisma.asset.findMany({
                        where: { id: { in: newIds } },
                        include: { uploadedBy: { select: { name: true } } }
                    });
                    finalResults.push(...vectorAssets);
                }
            }
        } catch (e) { console.warn("Vector fallback failed", e); }
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

// --- RECOMMENDATIONS (Pinterest "More Like This") ---
export const getRelatedAssets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Get the target asset's embedding
    // We need the vector to compare against others
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

    // 2. Find closest neighbors (excluding itself)
    // FIX: Tighten threshold to 0.35 (Strict Similarity)
        // "Show me things that are VERY similar to this"
        const relatedAssets = await prisma.$queryRaw`
          SELECT id, filename, "originalName", "mimeType", "thumbnailPath", "aiData"
          FROM "Asset"
          WHERE id != ${id}
          AND embedding IS NOT NULL
          AND (embedding <=> ${vectorString}::vector) < 0.35
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT 10;
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