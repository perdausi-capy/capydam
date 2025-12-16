"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAsset = exports.updateAsset = exports.getRelatedAssets = exports.getAssetById = exports.getAssets = exports.trackAssetClick = exports.uploadAsset = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const ai_service_1 = require("../services/ai.service");
const natural_1 = __importDefault(require("natural"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
// Import Services
const storage_service_1 = require("../services/storage.service");
const image_service_1 = require("../services/image.service");
const ai_service_2 = require("../services/ai.service");
// --- UPLOAD (Synchronous: Waits for AI) ---
const uploadAsset = async (req, res) => {
    const multerReq = req;
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
            }
            catch (e) {
                console.warn("Could not parse frontend aiData");
            }
        }
        // 2. Generate Thumbnails (Locally)
        const thumbnailDir = path_1.default.join(__dirname, '../../uploads/thumbnails');
        await fs_extra_1.default.ensureDir(thumbnailDir);
        let thumbnailRelativePath = null;
        try {
            if (mimetype.startsWith('image/')) {
                thumbnailRelativePath = await (0, image_service_1.generateThumbnail)(tempPath, thumbnailDir);
            }
            else if (mimetype.startsWith('video/')) {
                thumbnailRelativePath = await (0, image_service_1.generateVideoThumbnail)(tempPath, thumbnailDir);
            }
            else if (mimetype === 'application/pdf') {
                thumbnailRelativePath = await (0, image_service_1.generatePdfThumbnail)(tempPath, thumbnailDir);
            }
        }
        catch (thumbError) {
            console.warn("Thumbnail generation failed:", thumbError);
            thumbnailRelativePath = null;
        }
        // 3. Upload ORIGINAL to Supabase
        const cloudOriginalPath = await (0, storage_service_1.uploadToSupabase)(tempPath, `originals/${filename}`, mimetype);
        // 4. Upload THUMBNAIL to Supabase
        let cloudThumbnailPath = null;
        if (thumbnailRelativePath) {
            const localThumbPath = path_1.default.join(__dirname, '../../uploads/', thumbnailRelativePath);
            // Detect if it's WebP (for GIFs) or JPEG
            const isWebP = thumbnailRelativePath.endsWith('.webp');
            cloudThumbnailPath = await (0, storage_service_1.uploadToSupabase)(localThumbPath, thumbnailRelativePath, isWebP ? 'image/webp' : 'image/jpeg');
            await fs_extra_1.default.remove(localThumbPath);
        }
        // 5. Initial Save to Database
        // We save the user's link here immediately.
        const asset = await prisma_1.prisma.asset.create({
            data: {
                filename,
                originalName: finalOriginalName,
                mimeType: mimetype,
                size,
                path: cloudOriginalPath,
                thumbnailPath: cloudThumbnailPath,
                userId: userId,
                aiData: JSON.stringify(initialAiData), // ✅ Stores { externalLink: ... }
            },
        });
        // 6. Trigger AI Analysis (Synchronous Wait)
        const aiOptions = { creativity, specificity };
        try {
            console.log(`🤖 Starting AI Analysis for ${asset.id} (${mimetype})...`);
            if (mimetype === 'image/gif') {
                await (0, ai_service_2.analyzeAudioVideo)(asset.id, tempPath, aiOptions);
            }
            else if (mimetype.startsWith('image/')) {
                await (0, ai_service_2.analyzeImage)(asset.id, tempPath, aiOptions);
            }
            else if (mimetype === 'application/pdf') {
                await (0, ai_service_2.analyzePdf)(asset.id, tempPath, aiOptions);
            }
            else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
                await (0, ai_service_2.analyzeAudioVideo)(asset.id, tempPath, aiOptions);
            }
            console.log(`✅ AI Analysis Finished for ${asset.id}`);
        }
        catch (err) {
            console.error("AI Analysis Warning (continuing):", err);
        }
        finally {
            // Cleanup temp file
            await new Promise(resolve => setTimeout(resolve, 500)); // Delay for file locks
            console.log(`🧹 Cleaning up temp file: ${tempPath}`);
            await fs_extra_1.default.remove(tempPath).catch(e => console.error("Cleanup error:", e));
        }
        // 7. SAFETY RESTORE: Ensure the Link persists
        // The AI process above might have done `prisma.asset.update` with new tags,
        // potentially overwriting our `aiData` JSON. We must check and merge.
        let finalAsset = await prisma_1.prisma.asset.findUnique({ where: { id: asset.id } });
        // Only run this merge logic if the user actually provided a link
        if (req.body.aiData && finalAsset) {
            const currentAiData = finalAsset.aiData ? JSON.parse(finalAsset.aiData) : {};
            // Merge: Keep the new AI tags + Force the User Link back in
            const mergedAiData = {
                ...currentAiData,
                ...initialAiData // This ensures { externalLink: "..." } wins
            };
            // Write the merged data back to DB
            finalAsset = await prisma_1.prisma.asset.update({
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
    }
    catch (error) {
        // Cleanup if critical error
        if (await fs_extra_1.default.pathExists(tempPath)) {
            await fs_extra_1.default.remove(tempPath).catch(() => { });
        }
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Server error processing upload' });
    }
};
exports.uploadAsset = uploadAsset;
// --- TRACK CLICKS ---
const trackAssetClick = async (req, res) => {
    try {
        const { assetId, query, position } = req.body;
        const userId = req.user?.id;
        await prisma_1.prisma.assetClick.create({
            data: { assetId, query: query || '', position, userId }
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false });
    }
};
exports.trackAssetClick = trackAssetClick;
// --- GET ASSETS (Search Engine V3.0 - Fixed) ---
const getAssets = async (req, res) => {
    try {
        const { search, type, color } = req.query;
        const cleanSearch = String(search || '').trim().toLowerCase();
        // --- MODE A: BROWSE (No Text Search) ---
        // This runs when you just load the dashboard. Fast & Accurate.
        if (!cleanSearch) {
            const whereClause = {};
            // 1. Filter by Type
            if (type && type !== 'all') {
                if (type === 'image')
                    whereClause.mimeType = { startsWith: 'image/' };
                else if (type === 'video')
                    whereClause.mimeType = { startsWith: 'video/' };
                else if (type === 'document')
                    whereClause.mimeType = 'application/pdf';
            }
            // 2. Filter by Color
            if (color) {
                whereClause.aiData = { contains: String(color), mode: 'insensitive' };
            }
            const assets = await prisma_1.prisma.asset.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: 2000, // ✅ LIMIT INCREASED to 2000 (effectively "all")
                include: { uploadedBy: { select: { name: true } } }
            });
            // 3. SERVER-SIDE THUMBNAIL FIX
            // If thumbnail is missing, use the original path
            const fixedAssets = assets.map(asset => ({
                ...asset,
                thumbnailPath: asset.thumbnailPath || asset.path
            }));
            res.json(fixedAssets);
            return;
        }
        // --- MODE B: SEARCH (Text Query Active) ---
        const scoredMap = new Map();
        // 1. SMART EXPANSION
        let searchTerms = [];
        const stemmer = natural_1.default.PorterStemmer;
        const stem = stemmer.stem(cleanSearch);
        const shouldExpand = cleanSearch.length > 2 && cleanSearch.length < 6 && !cleanSearch.includes(' ');
        if (shouldExpand) {
            const expanded = await (0, ai_service_1.expandQuery)(cleanSearch);
            searchTerms = [...new Set([cleanSearch, stem, ...expanded])];
        }
        else {
            searchTerms = [cleanSearch, stem];
        }
        // 2. VECTOR SEARCH (Semantic)
        if (cleanSearch.length > 2) {
            try {
                const embedding = await (0, ai_service_1.generateEmbedding)(cleanSearch);
                if (embedding) {
                    const vectorString = `[${embedding.join(',')}]`;
                    const rawVectorAssets = await prisma_1.prisma.$queryRaw `
            SELECT id, (embedding <=> ${vectorString}::vector) as distance
            FROM "Asset"
            WHERE 1=1
            ${type && type !== 'all' ? client_1.Prisma.sql `AND "mimeType" LIKE ${type === 'image' ? 'image/%' : type === 'video' ? 'video/%' : '%pdf%'}` : client_1.Prisma.empty}
            ${color ? client_1.Prisma.sql `AND "aiData" ILIKE ${'%' + color + '%'}` : client_1.Prisma.empty}
            AND embedding IS NOT NULL
            ORDER BY distance ASC
            LIMIT 100; -- Vector search can keep a limit as it's sorted by relevance
          `;
                    if (rawVectorAssets.length > 0) {
                        const ids = rawVectorAssets.map(a => a.id);
                        const vectorAssets = await prisma_1.prisma.asset.findMany({
                            where: { id: { in: ids } },
                            include: { uploadedBy: { select: { name: true } } },
                        });
                        vectorAssets.forEach(asset => {
                            const match = rawVectorAssets.find(r => r.id === asset.id);
                            const distance = match?.distance || 1;
                            if (distance < 0.45) { // Slightly looser threshold
                                const semanticScore = 50 * Math.exp(-5 * distance);
                                scoredMap.set(asset.id, { asset, score: semanticScore, debug: `Vector (${distance.toFixed(3)})` });
                            }
                        });
                    }
                }
            }
            catch (err) {
                console.warn("Vector search failed", err);
            }
        }
        // 3. KEYWORD SEARCH (Exact Match)
        const keywordWhere = { AND: [] };
        if (type && type !== 'all') {
            if (type === 'image')
                keywordWhere.AND.push({ mimeType: { startsWith: 'image/' } });
            else if (type === 'video')
                keywordWhere.AND.push({ mimeType: { startsWith: 'video/' } });
            else if (type === 'document')
                keywordWhere.AND.push({ mimeType: 'application/pdf' });
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
        const keywordAssets = await prisma_1.prisma.asset.findMany({
            where: keywordWhere,
            include: { uploadedBy: { select: { name: true } } },
            take: 500, // ✅ INCREASED LIMIT for keyword matches
        });
        // 4. SCORING MERGE
        keywordAssets.forEach(asset => {
            let score = 0;
            const lowerName = asset.originalName.toLowerCase();
            const lowerAI = (asset.aiData || '').toLowerCase();
            const nameWithoutExt = lowerName.replace(/\.[^/.]+$/, "");
            if (nameWithoutExt === cleanSearch)
                score += 100;
            else if (nameWithoutExt.startsWith(cleanSearch))
                score += 70;
            else if (nameWithoutExt.includes(cleanSearch))
                score += 40;
            if (lowerAI.includes(cleanSearch))
                score += 30;
            const daysOld = (Date.now() - new Date(asset.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld < 30)
                score += 10 * (1 - daysOld / 30);
            if (scoredMap.has(asset.id)) {
                const existing = scoredMap.get(asset.id);
                scoredMap.set(asset.id, {
                    asset,
                    score: existing.score + score,
                    debug: existing.debug + ` + Keyword (${score.toFixed(0)})`
                });
            }
            else {
                scoredMap.set(asset.id, { asset, score, debug: `Keyword (${score.toFixed(0)})` });
            }
        });
        // 5. CLICK BOOST
        if (cleanSearch) {
            const clickCounts = await prisma_1.prisma.assetClick.groupBy({
                by: ['assetId'],
                where: { query: cleanSearch },
                _count: true
            });
            clickCounts.forEach(c => {
                if (scoredMap.has(c.assetId)) {
                    const entry = scoredMap.get(c.assetId);
                    const boost = Math.log10(c._count + 1) * 10;
                    entry.score += boost;
                }
            });
        }
        // 6. SORT, FALLBACK & RETURN
        let finalResults = Array.from(scoredMap.values())
            .sort((a, b) => b.score - a.score)
            .map(item => item.asset);
        // Logging
        if (cleanSearch) {
            await prisma_1.prisma.searchLog.create({
                data: {
                    query: cleanSearch,
                    resultCount: finalResults.length,
                    userId: req.user?.id || null
                }
            }).catch(e => { });
        }
        // Fallback if no results found for search
        if (finalResults.length === 0) {
            const fallbackAssets = await prisma_1.prisma.asset.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
                include: { uploadedBy: { select: { name: true } } }
            });
            // Patch Fallback Thumbnails too
            const fixedFallback = fallbackAssets.map(asset => ({
                ...asset,
                thumbnailPath: asset.thumbnailPath || asset.path
            }));
            res.json({ results: fixedFallback, isFallback: true });
            return;
        }
        // ✅ FINAL THUMBNAIL PATCH (Search Mode)
        const fixedResults = finalResults.map(asset => ({
            ...asset,
            thumbnailPath: asset.thumbnailPath || asset.path
        }));
        res.json(fixedResults);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching assets' });
    }
};
exports.getAssets = getAssets;
// --- GET ONE ---
const getAssetById = async (req, res) => {
    try {
        const { id } = req.params;
        const asset = await prisma_1.prisma.asset.findUnique({
            where: { id },
            include: { uploadedBy: { select: { name: true, email: true } } },
        });
        if (!asset) {
            res.status(404).json({ message: 'Asset not found' });
            return;
        }
        res.json(asset);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
exports.getAssetById = getAssetById;
// --- RECOMMENDATIONS ---
const getRelatedAssets = async (req, res) => {
    try {
        const { id } = req.params;
        const targetAsset = await prisma_1.prisma.$queryRaw `
      SELECT embedding::text 
      FROM "Asset" 
      WHERE id = ${id}
    `;
        if (!targetAsset || targetAsset.length === 0 || !targetAsset[0].embedding) {
            res.json([]);
            return;
        }
        const vectorString = targetAsset[0].embedding;
        const relatedAssets = await prisma_1.prisma.$queryRaw `
      SELECT id, filename, "originalName", "mimeType", "thumbnailPath", "aiData"
      FROM "Asset"
      WHERE id != ${id}
      AND embedding IS NOT NULL
      AND (embedding <=> ${vectorString}::vector) < 0.60
      ORDER BY embedding <=> ${vectorString}::vector
      LIMIT 20;
    `;
        res.json(relatedAssets);
    }
    catch (error) {
        console.error("Error fetching related assets:", error);
        res.status(500).json({ message: 'Failed to fetch related assets' });
    }
};
exports.getRelatedAssets = getRelatedAssets;
// --- UPDATE ---
const updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { originalName, aiData } = req.body;
        const asset = await prisma_1.prisma.asset.update({
            where: { id },
            data: {
                originalName,
                aiData: typeof aiData === 'object' ? JSON.stringify(aiData) : aiData,
            },
        });
        res.json(asset);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating asset' });
    }
};
exports.updateAsset = updateAsset;
// --- DELETE ---
const deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const asset = await prisma_1.prisma.asset.findUnique({ where: { id } });
        if (!asset) {
            res.status(404).json({ message: 'Asset not found' });
            return;
        }
        if (userRole !== 'admin' && asset.userId !== userId) {
            res.status(403).json({ message: 'You do not have permission to delete this asset.' });
            return;
        }
        // 1. Delete from Database
        await prisma_1.prisma.asset.delete({ where: { id } });
        // 2. Delete from Supabase (Cloud)
        // We pass the Full URL, the service parses it
        if (asset.path)
            await (0, storage_service_1.deleteFromSupabase)(asset.path);
        if (asset.thumbnailPath)
            await (0, storage_service_1.deleteFromSupabase)(asset.thumbnailPath);
        res.json({ message: 'Asset deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error deleting asset' });
    }
};
exports.deleteAsset = deleteAsset;
