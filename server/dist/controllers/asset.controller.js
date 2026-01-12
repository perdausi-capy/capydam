"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAsset = exports.updateAsset = exports.getRelatedAssets = exports.getAssetById = exports.getAssets = exports.trackAssetClick = exports.uploadAsset = void 0;
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
// Import Storage Services
const storage_service_1 = require("../services/storage.service");
// Import Image Services
const image_service_1 = require("../services/image.service");
// Import AI Services
const ai_service_1 = require("../services/ai.service");
// ==========================================
// 1. UPLOAD ASSET (Synchronous Wait for AI)
// ==========================================
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
        // A. Capture User Inputs
        const finalOriginalName = req.body.originalName || multerOriginalName;
        let initialAiData = {};
        if (req.body.aiData) {
            try {
                initialAiData = JSON.parse(req.body.aiData);
            }
            catch (e) {
                console.warn("Could not parse frontend aiData");
            }
        }
        // B. Setup Local Thumbnail Directory
        const thumbnailDir = path_1.default.join(__dirname, '../../uploads/thumbnails');
        await fs_extra_1.default.ensureDir(thumbnailDir);
        let thumbnailRelativePath = null;
        let previewFrames = []; // ✅ Store 10 frame URLs here
        // C. Generate Thumbnails & Previews (Locally)
        try {
            if (mimetype.startsWith('image/')) {
                thumbnailRelativePath = await (0, image_service_1.generateThumbnail)(tempPath, thumbnailDir);
            }
            else if (mimetype.startsWith('video/')) {
                // 1. Main Thumbnail
                thumbnailRelativePath = await (0, image_service_1.generateVideoThumbnail)(tempPath, thumbnailDir);
                // 2. ✅ Generate 10 Scrubbing Previews
                try {
                    // Generate local files (e.g., vid-scrub-1.jpg ... vid-scrub-10.jpg)
                    const previewFiles = await (0, image_service_1.generateVideoPreviews)(tempPath, thumbnailDir, filename);
                    // Upload each frame to Supabase immediately
                    for (const pFile of previewFiles) {
                        const localPPath = path_1.default.join(thumbnailDir, pFile);
                        const cloudPPath = await (0, storage_service_1.uploadToSupabase)(localPPath, `previews/${pFile}`, 'image/jpeg');
                        previewFrames.push(cloudPPath);
                        await fs_extra_1.default.remove(localPPath); // Cleanup local frame
                    }
                }
                catch (videoError) {
                    console.warn("Video preview generation failed:", videoError);
                }
            }
            else if (mimetype === 'application/pdf') {
                thumbnailRelativePath = await (0, image_service_1.generatePdfThumbnail)(tempPath, thumbnailDir);
            }
        }
        catch (thumbError) {
            console.warn("Thumbnail generation failed:", thumbError);
            thumbnailRelativePath = null;
        }
        // D. Upload ORIGINAL to Supabase
        const cloudOriginalPath = await (0, storage_service_1.uploadToSupabase)(tempPath, `originals/${filename}`, mimetype);
        // E. Upload THUMBNAIL to Supabase
        let cloudThumbnailPath = null;
        if (thumbnailRelativePath) {
            const localThumbPath = path_1.default.join(__dirname, '../../uploads/', thumbnailRelativePath);
            const isWebP = thumbnailRelativePath.endsWith('.webp');
            cloudThumbnailPath = await (0, storage_service_1.uploadToSupabase)(localThumbPath, thumbnailRelativePath, isWebP ? 'image/webp' : 'image/jpeg');
            await fs_extra_1.default.remove(localThumbPath);
        }
        // F. Save to Database
        const asset = await prisma_1.prisma.asset.create({
            data: {
                filename,
                originalName: finalOriginalName,
                mimeType: mimetype,
                size,
                path: cloudOriginalPath,
                thumbnailPath: cloudThumbnailPath,
                previewFrames: previewFrames, // ✅ Save the frames array
                userId: userId,
                aiData: JSON.stringify(initialAiData),
            },
        });
        // G. Trigger AI Analysis
        const aiOptions = { creativity, specificity };
        try {
            console.log(`🤖 Starting AI Analysis for ${asset.id} (${mimetype})...`);
            if (mimetype === 'image/gif') {
                await (0, ai_service_1.analyzeAudioVideo)(asset.id, tempPath, aiOptions);
            }
            else if (mimetype.startsWith('image/')) {
                await (0, ai_service_1.analyzeImage)(asset.id, tempPath, aiOptions);
            }
            else if (mimetype === 'application/pdf') {
                await (0, ai_service_1.analyzePdf)(asset.id, tempPath, aiOptions);
            }
            else if (mimetype.startsWith('audio/') || mimetype.startsWith('video/')) {
                await (0, ai_service_1.analyzeAudioVideo)(asset.id, tempPath, aiOptions);
            }
            console.log(`✅ AI Analysis Finished for ${asset.id}`);
        }
        catch (err) {
            console.error("AI Analysis Warning (continuing):", err);
        }
        finally {
            await new Promise(resolve => setTimeout(resolve, 500));
            await fs_extra_1.default.remove(tempPath).catch(e => console.error("Cleanup error:", e));
        }
        // H. Merge AI Data back into DB record (if frontend provided some)
        let finalAsset = await prisma_1.prisma.asset.findUnique({ where: { id: asset.id } });
        if (req.body.aiData && finalAsset) {
            const currentAiData = finalAsset.aiData ? JSON.parse(finalAsset.aiData) : {};
            const mergedAiData = {
                ...currentAiData,
                ...initialAiData
            };
            finalAsset = await prisma_1.prisma.asset.update({
                where: { id: asset.id },
                data: { aiData: JSON.stringify(mergedAiData) }
            });
        }
        res.status(201).json({
            message: 'Asset uploaded and analyzed successfully',
            asset: finalAsset || asset,
        });
    }
    catch (error) {
        // Emergency Cleanup
        if (await fs_extra_1.default.pathExists(tempPath)) {
            await fs_extra_1.default.remove(tempPath).catch(() => { });
        }
        console.error('Upload error:', error);
        res.status(500).json({ message: 'Server error processing upload' });
    }
};
exports.uploadAsset = uploadAsset;
// ==========================================
// 2. TRACK CLICKS (Analytics)
// ==========================================
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
// ==========================================
// 3. GET ASSETS (Optimized V5.0) - with Soft Delete Support
// ==========================================
const getAssets = async (req, res) => {
    try {
        const { search, type, color, page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Math.min(100, Number(limit)));
        const skip = (pageNum - 1) * limitNum;
        const cleanSearch = String(search || '').trim().toLowerCase();
        // A. Reusable Filter Logic
        const buildFilters = () => {
            const filters = {
                // ✅ CRITICAL: Only show assets that are NOT in the trash
                deletedAt: null
            };
            if (type && type !== 'all') {
                if (type === 'image')
                    filters.mimeType = { startsWith: 'image/' };
                else if (type === 'video')
                    filters.mimeType = { startsWith: 'video/' };
                else if (type === 'document')
                    filters.mimeType = 'application/pdf';
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
                prisma_1.prisma.asset.count({ where: activeFilters }),
                prisma_1.prisma.asset.findMany({
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
        const scoredMap = new Map();
        let searchTerms = [cleanSearch];
        // Ensure activeFilters (including deletedAt: null) are applied to search
        const keywordWhere = {
            AND: [activeFilters]
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
        const keywordAssets = await prisma_1.prisma.asset.findMany({
            where: keywordWhere,
            select: lightweightSelect,
            take: 200,
        });
        // Score Candidates
        keywordAssets.forEach(asset => {
            let score = 0;
            const lowerName = (asset.originalName || '').toLowerCase();
            const lowerAI = (String(asset.aiData) || '').toLowerCase();
            if (lowerName === cleanSearch)
                score += 100;
            else if (lowerName.includes(cleanSearch))
                score += 50;
            if (lowerAI.includes(cleanSearch))
                score += 30;
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
            const fallbackAssets = await prisma_1.prisma.asset.findMany({
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
    }
    catch (error) {
        console.error("Get Assets Error:", error);
        res.status(500).json({ message: 'Error fetching assets' });
    }
};
exports.getAssets = getAssets;
// ==========================================
// 4. GET SINGLE ASSET
// ==========================================
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
// ==========================================
// 5. GET RELATED ASSETS (Recommendations)
// ==========================================
const getRelatedAssets = async (req, res) => {
    try {
        const { id } = req.params;
        const targetAsset = await prisma_1.prisma.asset.findUnique({
            where: { id },
            select: { id: true, originalName: true, aiData: true, mimeType: true }
        });
        if (!targetAsset) {
            res.json([]);
            return;
        }
        let typeFilter = {};
        if (targetAsset.mimeType.startsWith('image/')) {
            typeFilter = { mimeType: { startsWith: 'image/' } };
        }
        else if (targetAsset.mimeType.startsWith('video/')) {
            typeFilter = { mimeType: { startsWith: 'video/' } };
        }
        else if (targetAsset.mimeType === 'application/pdf') {
            typeFilter = { mimeType: 'application/pdf' };
        }
        const stopWords = new Set(['image', 'img', 'pic', 'picture', 'photo', 'screenshot', 'screen', 'shot', 'copy', 'final', 'draft', 'upload', 'new', 'old', 'backup', 'ds', 'store', 'frame', 'rectangle', 'group', 'vector', 'untitled', 'design', 'migration', 'import', 'jpg', 'png', 'mp4']);
        const rawName = targetAsset.originalName || '';
        const nameKeywords = rawName.split(/[\s_\-\.\/]+/).map(w => w.toLowerCase()).filter(w => w.length > 3 && !/^\d+$/.test(w) && !stopWords.has(w));
        let tagKeywords = [];
        try {
            const parsed = JSON.parse(targetAsset.aiData || '{}');
            if (Array.isArray(parsed.tags))
                tagKeywords = parsed.tags;
            if (typeof parsed.keywords === 'string')
                tagKeywords = parsed.keywords.split(',');
        }
        catch (e) { }
        const searchTerms = [...new Set([...tagKeywords, ...nameKeywords])].slice(0, 10);
        // Fallback: Recent items of same type
        if (searchTerms.length === 0) {
            const recent = await prisma_1.prisma.asset.findMany({
                where: { id: { not: id }, ...typeFilter },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { id: true, filename: true, originalName: true, mimeType: true, thumbnailPath: true, aiData: true, previewFrames: true }
            });
            res.json(recent);
            return;
        }
        // Search Candidates
        const candidates = await prisma_1.prisma.asset.findMany({
            where: {
                id: { not: id },
                ...typeFilter,
                OR: [
                    ...searchTerms.map(t => ({ originalName: { contains: t, mode: client_1.Prisma.QueryMode.insensitive } })),
                    ...searchTerms.map(t => ({ aiData: { contains: t, mode: client_1.Prisma.QueryMode.insensitive } }))
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
                if (lowerName.includes(lowerTerm))
                    score += 50;
                if (lowerAI.includes(lowerTerm))
                    score += 30;
                if (lowerName === lowerTerm)
                    score += 50;
            });
            return { asset, score };
        });
        const finalResults = scoredAssets.filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 20).map(item => item.asset);
        // Fallback if scoring returned nothing
        if (finalResults.length === 0) {
            const recent = await prisma_1.prisma.asset.findMany({
                where: { id: { not: id }, ...typeFilter },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: { id: true, filename: true, originalName: true, mimeType: true, thumbnailPath: true, aiData: true, previewFrames: true }
            });
            res.json(recent);
            return;
        }
        res.json(finalResults);
    }
    catch (error) {
        console.error("Related Error:", error);
        res.status(500).json({ message: 'Error' });
    }
};
exports.getRelatedAssets = getRelatedAssets;
// ==========================================
// 6. UPDATE ASSET
// ==========================================
const updateAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const { originalName, aiData } = req.body;
        const asset = await prisma_1.prisma.asset.update({
            where: { id },
            data: { originalName, aiData: typeof aiData === 'object' ? JSON.stringify(aiData) : aiData },
        });
        res.json(asset);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating asset' });
    }
};
exports.updateAsset = updateAsset;
// ==========================================
// 7. DELETE ASSET (Soft Delete / Move to Trash)
// ==========================================
const deleteAsset = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        console.log(`\n🗑️ [SOFT DELETE] Moving Asset ID to Trash: ${id}`);
        // 1. Find the Asset
        const asset = await prisma_1.prisma.asset.findUnique({ where: { id } });
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
        await prisma_1.prisma.asset.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        res.json({ message: 'Asset moved to recycle bin' });
    }
    catch (error) {
        console.error("🔥 SOFT DELETE ERROR:", error);
        res.status(500).json({ message: 'Server error', error: String(error) });
    }
};
exports.deleteAsset = deleteAsset;
