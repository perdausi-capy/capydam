"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const storage_service_1 = require("../services/storage.service");
const image_service_1 = require("../services/image.service");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const TEMP_DIR = path_1.default.join(__dirname, '../../uploads/temp_backfill');
const THUMB_DIR = path_1.default.join(__dirname, '../../uploads/thumbnails');
// Helper: Download file from URL
async function downloadFile(url, dest) {
    const writer = fs_extra_1.default.createWriteStream(dest);
    const response = await (0, axios_1.default)({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(undefined)); // ✅ Fixed type error
        writer.on('error', reject);
    });
}
async function backfillThumbnails() {
    console.log("🎨 Starting Thumbnail Backfill...");
    // Ensure dirs exist
    await fs_extra_1.default.ensureDir(TEMP_DIR);
    await fs_extra_1.default.ensureDir(THUMB_DIR);
    // 1. Find assets with NO thumbnail (and verify they are valid types)
    const assets = await prisma.asset.findMany({
        where: {
            thumbnailPath: null,
            OR: [
                { mimeType: { startsWith: 'image/' } },
                { mimeType: { startsWith: 'video/' } },
                { mimeType: 'application/pdf' }
            ]
        },
        // Process in batches if you have thousands, but let's do all for now
    });
    console.log(`Found ${assets.length} assets missing thumbnails.`);
    let successCount = 0;
    let errorCount = 0;
    for (const [index, asset] of assets.entries()) {
        const ext = path_1.default.extname(asset.originalName) || '.dat';
        const tempFilePath = path_1.default.join(TEMP_DIR, `${asset.id}${ext}`);
        console.log(`\n[${index + 1}/${assets.length}] Processing: ${asset.originalName}`);
        try {
            // A. Download Original
            // console.log(`   ⬇️ Downloading...`);
            await downloadFile(asset.path, tempFilePath);
            // B. Generate Thumbnail
            let relativeThumbPath = null;
            // console.log(`   ⚙️ Generating thumbnail...`);
            if (asset.mimeType.startsWith('image/')) {
                relativeThumbPath = await (0, image_service_1.generateThumbnail)(tempFilePath, THUMB_DIR);
            }
            else if (asset.mimeType.startsWith('video/')) {
                relativeThumbPath = await (0, image_service_1.generateVideoThumbnail)(tempFilePath, THUMB_DIR);
            }
            else if (asset.mimeType === 'application/pdf') {
                relativeThumbPath = await (0, image_service_1.generatePdfThumbnail)(tempFilePath, THUMB_DIR);
            }
            if (!relativeThumbPath)
                throw new Error("Thumbnail generation returned null");
            // C. Upload to Cloud
            // console.log(`   ☁️ Uploading to Supabase...`);
            const localThumbPath = path_1.default.join(__dirname, '../../uploads', relativeThumbPath);
            // Determine content type for upload
            const isWebP = relativeThumbPath.endsWith('.webp');
            const contentType = isWebP ? 'image/webp' : 'image/jpeg';
            const cloudThumbPath = await (0, storage_service_1.uploadToSupabase)(localThumbPath, relativeThumbPath, // Keep folder structure if service uses it
            contentType);
            // D. Update DB
            await prisma.asset.update({
                where: { id: asset.id },
                data: { thumbnailPath: cloudThumbPath }
            });
            // Cleanup local generated thumb
            await fs_extra_1.default.remove(localThumbPath);
            console.log(`   ✅ Success! Thumbnail linked.`);
            successCount++;
        }
        catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
            errorCount++;
        }
        finally {
            // Cleanup downloaded original
            if (await fs_extra_1.default.pathExists(tempFilePath)) {
                await fs_extra_1.default.remove(tempFilePath);
            }
        }
    }
    console.log(`\n✨ Backfill Complete! Success: ${successCount}, Errors: ${errorCount}`);
    // Final Cleanup
    await fs_extra_1.default.remove(TEMP_DIR);
    // Note: THUMB_DIR might be needed by the app, so we keep it or check logic
}
backfillThumbnails()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
