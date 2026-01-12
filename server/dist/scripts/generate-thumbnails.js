"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const supabase_js_1 = require("@supabase/supabase-js");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const https_1 = __importDefault(require("https"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
// Temp folder for processing
const TEMP_DIR = path_1.default.join(__dirname, 'temp_videos');
// Helper to download file from Supabase
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(dest);
        https_1.default.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs_1.default.unlink(dest, () => { });
            reject(err);
        });
    });
}
async function generateThumbnails() {
    console.log('🎬 Starting Fix for Migrated Video Thumbnails...');
    // Ensure temp dir exists
    if (!fs_1.default.existsSync(TEMP_DIR))
        fs_1.default.mkdirSync(TEMP_DIR);
    // 1. Find ALL videos
    const videos = await prisma.asset.findMany({
        where: {
            mimeType: { startsWith: 'video/' },
        }
    });
    console.log(`Found ${videos.length} total videos.`);
    for (const video of videos) {
        // 2. SKIP VALID ONES
        // If it has a thumbnail AND that thumbnail is a JPG/PNG, it's good.
        // If thumbnail is NULL or ends in .mp4 (our fallback), it's BROKEN -> Fix it.
        const isBroken = !video.thumbnailPath || video.thumbnailPath.endsWith('.mp4') || video.thumbnailPath.endsWith('.m4v');
        if (!isBroken) {
            // console.log(`Skipping good video: ${video.originalName}`);
            continue;
        }
        console.log(`🔨 Fixing: ${video.originalName} (ID: ${video.id})`);
        const videoPath = path_1.default.join(TEMP_DIR, `${video.id}_temp.mp4`);
        const thumbName = `${video.id}_thumb.jpg`;
        const thumbPath = path_1.default.join(TEMP_DIR, thumbName);
        try {
            // A. Download Video
            await downloadFile(video.path, videoPath);
            // B. Generate Thumbnail (Screenshot at 1 sec)
            await new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(videoPath)
                    .screenshots({
                    timestamps: ['1'], // Take shot at 1 second mark
                    filename: thumbName,
                    folder: TEMP_DIR,
                    size: '320x?', // Width 320px, auto height
                })
                    .on('end', resolve)
                    .on('error', reject);
            });
            // C. Upload to Supabase
            const fileBuffer = fs_1.default.readFileSync(thumbPath);
            const cloudPath = `thumbnails/${thumbName}`; // Save as clean JPG
            const { error: uploadError } = await supabase.storage
                .from('assets')
                .upload(cloudPath, fileBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });
            if (uploadError)
                throw uploadError;
            const { data: publicUrl } = supabase.storage
                .from('assets')
                .getPublicUrl(cloudPath);
            // D. Update Database with the NEW JPG Link
            await prisma.asset.update({
                where: { id: video.id },
                data: { thumbnailPath: publicUrl.publicUrl }
            });
            console.log(`✅ Fixed!`);
        }
        catch (err) {
            console.error(`❌ Failed ${video.id}: ${err.message}`);
        }
        finally {
            // Cleanup temp files immediately to save space
            if (fs_1.default.existsSync(videoPath))
                fs_1.default.unlinkSync(videoPath);
            if (fs_1.default.existsSync(thumbPath))
                fs_1.default.unlinkSync(thumbPath);
        }
    }
    console.log('✨ All broken thumbnails repaired!');
    if (fs_1.default.existsSync(TEMP_DIR))
        fs_1.default.rmdirSync(TEMP_DIR);
}
generateThumbnails()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
