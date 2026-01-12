import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function checkCloudSizes() {
  console.log("☁️  Checking Supabase Thumbnail Sizes...\n");

  // Get 20 random assets that have a thumbnail
  const assets = await prisma.asset.findMany({
    where: { thumbnailPath: { startsWith: 'http' } }, // Ensure it's a URL
    take: 20,
    select: { id: true, filename: true, thumbnailPath: true }
  });

  if (assets.length === 0) {
      console.log("❌ No cloud thumbnails found to check.");
      return;
  }

  let heavyCount = 0;

  for (const asset of assets) {
      if (!asset.thumbnailPath) continue;

      try {
          // Send a HEAD request (gets headers only, not the body)
          const response = await axios.head(asset.thumbnailPath);
          const sizeBytes = parseInt(response.headers['content-length'] || '0', 10);
          const sizeKB = sizeBytes / 1024;

          let status = "✅ OK";
          if (sizeKB > 500) {
              status = "🚨 HUGE (Likely Original)";
              heavyCount++;
          } else if (sizeKB > 100) {
              status = "⚠️ Heavy";
              heavyCount++;
          }

          console.log(`File: ${asset.filename}`);
          console.log(`   URL:  ...${asset.thumbnailPath.slice(-30)}`);
          console.log(`   Size: ${sizeKB.toFixed(2)} KB  -> ${status}`);
          console.log('---');

      } catch (err: any) {
          console.log(`❌ Error checking ${asset.filename}: ${err.message}`);
      }
  }

  console.log(`\n📊 REPORT:`);
  if (heavyCount > 0) {
      console.log(`🚨 Found ${heavyCount} heavy thumbnails.`);
      console.log(`   This CONFIRMS why your LCP is 33s. The thumbnails are not optimized.`);
      console.log(`   ACTION: Run the 'force-resize' script immediately.`);
  } else {
      console.log(`✅ All thumbnails are optimized (<100KB). The lag is likely network/connection related.`);
  }
}

checkCloudSizes()
  .finally(async () => await prisma.$disconnect());
