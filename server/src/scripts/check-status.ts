/// <reference types="node" />
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStatus() {
  console.log("📊 Checking Migration Status...");

  // 1. Fetch all video assets (just IDs and frames to be fast)
  const assets = await prisma.asset.findMany({
    where: { mimeType: { startsWith: 'video/' } },
    select: { id: true, previewFrames: true }
  });

  let totalVideos = assets.length;
  let remaining = 0;
  let migrated = 0;

  for (const asset of assets) {
    // Check if frames exist and if the first one points to Supabase
    if (asset.previewFrames && asset.previewFrames.length > 0) {
      if (asset.previewFrames[0].includes('supabase.co')) {
        remaining++;
      } else {
        migrated++;
      }
    } else {
      // No frames = considered "done" or not applicable
      migrated++;
    }
  }

  console.log(`\n=============================`);
  console.log(`🎥 Total Videos:     ${totalVideos}`);
  console.log(`✅ Fully Migrated:   ${migrated}`);
  console.log(`⏳ Remaining:        ${remaining}`);
  console.log(`=============================`);
  
  const percentage = ((migrated / totalVideos) * 100).toFixed(1);
  console.log(`🚀 Progress: ${percentage}% Complete`);
}

checkStatus()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
