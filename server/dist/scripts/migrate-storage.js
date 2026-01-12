"use strict";
/// <reference types="node" />
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const lib_storage_1 = require("@aws-sdk/lib-storage");
// ✅ Import changed: We are now inside src, so we go up one level (..) to lib
const storage_1 = require("../lib/storage");
const prisma = new client_1.PrismaClient();
async function migrate() {
    console.log("🚀 Starting Storage Migration...");
    const assets = await prisma.asset.findMany({
        where: {
            path: {
                contains: 'supabase.co'
            }
        }
    });
    console.log(`Found ${assets.length} files to migrate.`);
    let successCount = 0;
    let errorCount = 0;
    for (const asset of assets) {
        try {
            const currentUrl = asset.path;
            console.log(`\nProcessing: ${currentUrl}`);
            const response = await (0, axios_1.default)({
                method: 'get',
                url: currentUrl,
                responseType: 'stream'
            });
            // Split logic: grab everything after '/assets/'
            let destinationKey = currentUrl.split('/assets/')[1];
            if (!destinationKey) {
                destinationKey = currentUrl.split('/').pop() || 'unknown-file';
            }
            destinationKey = decodeURIComponent(destinationKey);
            const upload = new lib_storage_1.Upload({
                client: storage_1.storageClient,
                params: {
                    Bucket: storage_1.BUCKET_NAME,
                    Key: destinationKey,
                    Body: response.data,
                    ContentType: response.headers['content-type'],
                },
            });
            await upload.done();
            const newPath = `${storage_1.PUBLIC_URL_BASE}/${destinationKey}`;
            await prisma.asset.update({
                where: { id: asset.id },
                data: { path: newPath }
            });
            console.log(`✅ Migrated to: ${newPath}`);
            successCount++;
        }
        catch (error) {
            console.error(`❌ Failed to migrate asset ID ${asset.id}:`, error);
            errorCount++;
        }
    }
    console.log(`Migration Complete! Success: ${successCount}, Failed: ${errorCount}`);
}
migrate()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
