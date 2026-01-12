"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function run() {
    console.log("🧹 Starting Cleanup & Verification...\n");
    // --- TASK 1: FIX RAR FILES ---
    console.log("1️⃣ Fixing broken RAR assets...");
    const rarUpdates = await prisma.asset.updateMany({
        where: {
            mimeType: 'image/rar' // Incorrect type causing browser lag
        },
        data: {
            mimeType: 'application/vnd.rar' // Correct type (shows file icon)
        }
    });
    console.log(`   ✅ Fixed ${rarUpdates.count} RAR files. They will no longer choke the image loader.\n`);
    // --- TASK 2: VERIFY THUMBNAILS ---
    console.log("2️⃣ Verifying Thumbnail Paths...");
    const samples = await prisma.asset.findMany({
        where: { thumbnailPath: { not: null } },
        take: 5,
        select: { id: true, filename: true, path: true, thumbnailPath: true }
    });
    console.log("   Checking if thumbnails are real or just clones of the original...");
    let suspiciousCount = 0;
    samples.forEach((asset, i) => {
        const isThumbInFolder = asset.thumbnailPath?.includes('thumbnails/');
        const isThumbSameAsOriginal = asset.thumbnailPath === asset.path;
        console.log(`   [${i + 1}] ${asset.filename}`);
        console.log(`       Original:  ${asset.path}`);
        console.log(`       Thumbnail: ${asset.thumbnailPath}`);
        if (isThumbSameAsOriginal || !isThumbInFolder) {
            console.log(`       ⚠️ SUSPICIOUS: This looks like the original file!`);
            suspiciousCount++;
        }
        else {
            console.log(`       ✅ GOOD: Looks like a real thumbnail.`);
        }
        console.log('---');
    });
    if (suspiciousCount > 0) {
        console.log("\n🚨 DIAGNOSIS: Your 'thumbnails' are actually full-size original files.");
        console.log("   This is why the dashboard is heavy. You need to run the backfill script.");
    }
    else {
        console.log("\n✅ DIAGNOSIS: Thumbnails look correct. The lag might be caching or network related.");
    }
}
run()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
