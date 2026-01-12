import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
// ✅ CORRECTED IMPORT: Point to the new storage service (sibling file)
import { deleteFromSupabase } from './storage.service'; 

const prisma = new PrismaClient();
const EXPIRATION_DAYS = 30;

export const initCronJobs = () => {
  // Schedule: Run every day at Midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('🕒 [CRON] Running scheduled cleanup for expired trash...');
    await cleanupExpiredAssets();
  });

  console.log('✅ Cron jobs initialized');
};

const cleanupExpiredAssets = async () => {
  try {
    // 1. Calculate the cutoff date (30 days ago)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - EXPIRATION_DAYS);

    // 2. Find assets that were deleted BEFORE the cutoff date
    const expiredAssets = await prisma.asset.findMany({
      where: {
        deletedAt: {
          lt: cutoffDate, // "Less than" means older than the date
          not: null
        }
      }
    });

    if (expiredAssets.length === 0) {
      console.log('✅ [CRON] No expired assets found.');
      return;
    }

    console.log(`🗑️ [CRON] Found ${expiredAssets.length} assets older than ${EXPIRATION_DAYS} days. Deleting permanently...`);

    // 3. Delete Files from Storage (MinIO)
    for (const asset of expiredAssets) {
      try {
        // Delete Main File
        if (asset.path) await deleteFromSupabase(asset.path);
        
        // Delete Thumbnail
        if (asset.thumbnailPath) await deleteFromSupabase(asset.thumbnailPath);

        // Delete Preview Frames (Video)
        if (asset.previewFrames && asset.previewFrames.length > 0) {
          await Promise.all(asset.previewFrames.map(frame => deleteFromSupabase(frame)));
        }
      } catch (err) {
        console.error(`⚠️ [CRON] Failed to delete files for asset ${asset.id}`, err);
        // We continue anyway to ensure the DB record gets cleaned up
      }
    }

    // 4. Delete Database Records
    const assetIds = expiredAssets.map(a => a.id);

    // Clean up relations first (if cascade isn't set in DB)
    await prisma.$transaction([
      prisma.assetClick.deleteMany({ where: { assetId: { in: assetIds } } }),
      prisma.assetOnCategory.deleteMany({ where: { assetId: { in: assetIds } } }),
      prisma.assetOnCollection.deleteMany({ where: { assetId: { in: assetIds } } }),
      prisma.asset.deleteMany({ where: { id: { in: assetIds } } })
    ]);

    console.log(`✅ [CRON] Successfully permanently deleted ${expiredAssets.length} assets.`);

  } catch (error) {
    console.error('❌ [CRON] Critical error during cleanup:', error);
  }
};