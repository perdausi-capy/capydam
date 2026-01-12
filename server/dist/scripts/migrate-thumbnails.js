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
async function migrateThumbnails() {
    console.log("🚀 Starting THUMBNAIL Migration...");
    // 1. Find assets where the THUMBNAIL is still on Supabase
    // (Even if the main image is already on MinIO)
    const assets = await prisma.asset.findMany({
        where: {
            thumbnailPath: {
                contains: 'supabase.co'
            }
        }
    });
    console.log(`Found ${assets.length} thumbnails to migrate.`);
    let successCount = 0;
    let errorCount = 0;
    for (const asset of assets) {
        if (!asset.thumbnailPath)
            continue;
        try {
            const currentUrl = asset.thumbnailPath;
            console.log(`\nProcessing Thumbnail: ${currentUrl}`);
            // 2. Download Thumbnail
            const response = await (0, axios_1.default)({
                method: 'get',
                url: currentUrl,
                responseType: 'stream'
            });
            // 3. Extract Filename
            // Thumbnails usually live in a 'thumbnails' folder or similar
            let destinationKey = currentUrl.split('/assets/')[1];
            if (!destinationKey) {
                destinationKey = currentUrl.split('/').pop() || `thumb_${asset.id}.jpg`;
            }
            destinationKey = decodeURIComponent(destinationKey);
            // 4. Upload to MinIO
            const upload = new lib_storage_1.Upload({
                client: storage_1.storageClient,
                params: {
                    Bucket: storage_1.BUCKET_NAME,
                    Key: destinationKey,
                    Body: response.data,
                    ContentType: response.headers['content-type'] || 'image/jpeg',
                },
            });
            await upload.done();
            // 5. Update Database
            const newPath = `${storage_1.PUBLIC_URL_BASE}/${destinationKey}`;
            await prisma.asset.update({
                where: { id: asset.id },
                data: { thumbnailPath: newPath }
            });
            console.log(`✅ Migrated to: ${newPath}`);
            successCount++;
        }
        catch (error) {
            console.error(`❌ Failed thumb ID ${asset.id}:`, error);
            errorCount++;
        }
    }
    console.log(`Thumbnail Migration Complete! ✅ ${successCount} | ❌ ${errorCount}`);
}
migrateThumbnails()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
