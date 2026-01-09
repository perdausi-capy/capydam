import { PrismaClient } from '@prisma/client';
import { uploadToSupabase } from '../services/storage.service';
import { 
  generateThumbnail, 
  generateVideoThumbnail, 
  generatePdfThumbnail 
} from '../services/image.service';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

const TEMP_DIR = path.join(__dirname, '../../uploads/temp_backfill');
const THUMB_DIR = path.join(__dirname, '../../uploads/thumbnails');

// Helper: Download file from URL
async function downloadFile(url: string, dest: string) {
    const writer = fs.createWriteStream(dest);
    const response = await axios({
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
    await fs.ensureDir(TEMP_DIR);
    await fs.ensureDir(THUMB_DIR);

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
        const ext = path.extname(asset.originalName) || '.dat';
        const tempFilePath = path.join(TEMP_DIR, `${asset.id}${ext}`);
        
        console.log(`\n[${index + 1}/${assets.length}] Processing: ${asset.originalName}`);

        try {
            // A. Download Original
            // console.log(`   ⬇️ Downloading...`);
            await downloadFile(asset.path, tempFilePath);

            // B. Generate Thumbnail
            let relativeThumbPath: string | null = null;
            
            // console.log(`   ⚙️ Generating thumbnail...`);
            if (asset.mimeType.startsWith('image/')) {
                relativeThumbPath = await generateThumbnail(tempFilePath, THUMB_DIR);
            } else if (asset.mimeType.startsWith('video/')) {
                relativeThumbPath = await generateVideoThumbnail(tempFilePath, THUMB_DIR);
            } else if (asset.mimeType === 'application/pdf') {
                relativeThumbPath = await generatePdfThumbnail(tempFilePath, THUMB_DIR);
            }

            if (!relativeThumbPath) throw new Error("Thumbnail generation returned null");

            // C. Upload to Cloud
            // console.log(`   ☁️ Uploading to Supabase...`);
            const localThumbPath = path.join(__dirname, '../../uploads', relativeThumbPath);
            
            // Determine content type for upload
            const isWebP = relativeThumbPath.endsWith('.webp');
            const contentType = isWebP ? 'image/webp' : 'image/jpeg';

            const cloudThumbPath = await uploadToSupabase(
                localThumbPath,
                relativeThumbPath, // Keep folder structure if service uses it
                contentType
            );

            // D. Update DB
            await prisma.asset.update({
                where: { id: asset.id },
                data: { thumbnailPath: cloudThumbPath }
            });

            // Cleanup local generated thumb
            await fs.remove(localThumbPath);
            
            console.log(`   ✅ Success! Thumbnail linked.`);
            successCount++;

        } catch (err: any) {
            console.error(`   ❌ Failed: ${err.message}`);
            errorCount++;
        } finally {
            // Cleanup downloaded original
            if (await fs.pathExists(tempFilePath)) {
                await fs.remove(tempFilePath);
            }
        }
    }

    console.log(`\n✨ Backfill Complete! Success: ${successCount}, Errors: ${errorCount}`);
    
    // Final Cleanup
    await fs.remove(TEMP_DIR);
    // Note: THUMB_DIR might be needed by the app, so we keep it or check logic
}

backfillThumbnails()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
