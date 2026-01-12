import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function checkSizes() {
  console.log("⚖️  Weighing your thumbnails...\n");

  // Get 20 random assets with thumbnails
  const assets = await prisma.asset.findMany({
    where: { thumbnailPath: { not: null } },
    take: 20,
    select: { id: true, filename: true, thumbnailPath: true }
  });

  let hugeCount = 0;

  assets.forEach(asset => {
      if (!asset.thumbnailPath) return;

      // Construct local path (adjust if your uploads folder is different)
      // Assuming structure: server/uploads/thumbnails/file.jpg
      const localPath = path.join(__dirname, '../../uploads', asset.thumbnailPath);

      try {
          const stats = fs.statSync(localPath);
          const sizeKB = stats.size / 1024;
          
          let status = "✅ OK";
          if (sizeKB > 500) {
              status = "🚨 HUGE (Original?)";
              hugeCount++;
          } else if (sizeKB > 150) {
              status = "⚠️ Heavy";
              hugeCount++;
          }

          console.log(`File: ${asset.filename}`);
          console.log(`   Size: ${sizeKB.toFixed(2)} KB  -> ${status}`);
          console.log(`   Path: ${localPath}\n`);

      } catch (e) {
          console.log(`❌ Missing File: ${localPath}`);
      }
  });

  if (hugeCount > 0) {
      console.log(`\n🚨 DIAGNOSIS: Found ${hugeCount} massive thumbnails.`);
      console.log("   This is the cause of your LCP (33s). We need to crush them.");
  } else {
      console.log("\n✅ DIAGNOSIS: Thumbnails are small. The issue is network latency.");
  }
}

checkSizes()
  .finally(async () => await prisma.$disconnect());
