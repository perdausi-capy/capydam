"use strict";
/// <reference types="node" />
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const lib_storage_1 = require("@aws-sdk/lib-storage");
const storage_1 = require("../lib/storage");
const prisma = new client_1.PrismaClient();
async function migratePreviewFrames() {
    console.log("🚀 Starting PREVIEW FRAMES (Scrub) Migration...");
    // 1. Get all assets (Since we can't easily filter arrays for partial strings in Prisma, we fetch video assets)
    // Optimization: Only fetching videos reduces the load
    const assets = await prisma.asset.findMany({
        where: {
            mimeType: { startsWith: 'video/' }
        },
        select: { id: true, previewFrames: true } // Only fetch what we need
    });
    console.log(`Checking ${assets.length} video assets for Supabase previews...`);
    let successCount = 0;
    let errorCount = 0;
    for (const asset of assets) {
        // Skip if empty or already migrated (check the first frame)
        if (!asset.previewFrames || asset.previewFrames.length === 0)
            continue;
        if (!asset.previewFrames[0].includes('supabase.co'))
            continue;
        console.log(`\nProcessing Asset ID: ${asset.id} (${asset.previewFrames.length} frames)`);
        const newFrames = [];
        let assetHasError = false;
        // 2. Loop through every frame in the list
        for (const frameUrl of asset.previewFrames) {
            try {
                // Download
                const response = await (0, axios_1.default)({
                    method: 'get',
                    url: frameUrl,
                    responseType: 'stream'
                });
                // Determine Filename (e.g., "previews/1468...-scrub-10.jpg")
                let destinationKey = frameUrl.split('/assets/')[1];
                if (!destinationKey) {
                    destinationKey = `previews/${frameUrl.split('/').pop()}`;
                }
                destinationKey = decodeURIComponent(destinationKey);
                // Upload to MinIO
                const upload = new lib_storage_1.Upload({
                    client: storage_1.storageClient,
                    params: {
                        Bucket: storage_1.BUCKET_NAME,
                        Key: destinationKey,
                        Body: response.data,
                        ContentType: 'image/jpeg',
                    },
                });
                await upload.done();
                // Add new URL to our list
                newFrames.push(`${storage_1.PUBLIC_URL_BASE}/${destinationKey}`);
            }
            catch (error) {
                console.error(`❌ Failed to move frame: ${frameUrl}`);
                assetHasError = true;
                // Keep the old URL if migration fails so we don't break the array
                newFrames.push(frameUrl);
            }
        }
        // 3. Update the Database with the new list
        if (!assetHasError) {
            await prisma.asset.update({
                where: { id: asset.id },
                data: { previewFrames: newFrames }
            });
            console.log(`✅ Asset updated successfully.`);
            successCount++;
        }
        else {
            errorCount++;
        }
    }
    console.log(`\nJob Complete! ✅ Assets Updated: ${successCount} | ❌ Errors: ${errorCount}`);
}
migratePreviewFrames()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
