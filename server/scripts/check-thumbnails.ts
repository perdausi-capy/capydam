import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkThumbnails() {
  console.log("🔍 Checking Thumbnail Status...\n");

  // 1. Count Total
  const total = await prisma.asset.count();
  
  // 2. Count Missing Thumbnails
  const missing = await prisma.asset.count({
    where: { thumbnailPath: null }
  });

  // 3. Count Present Thumbnails
  const present = await prisma.asset.count({
    where: { thumbnailPath: { not: null } }
  });

  console.log(`📊 STATS:`);
  console.log(`- Total Assets:   ${total}`);
  console.log(`- ✅ With Thumb:  ${present}`);
  console.log(`- ❌ No Thumb:    ${missing}`);
  console.log(`------------------------------------------------`);

  if (missing > 0) {
      console.log(`⚠️ You have ${missing} assets causing the lag!`);
      console.log(`Here are the first 5 offenders:\n`);

      const examples = await prisma.asset.findMany({
          where: { thumbnailPath: null },
          take: 5,
          select: { id: true, filename: true, mimeType: true }
      });

      console.table(examples);
  } else {
      console.log(`🎉 All assets have thumbnails! The lag might be elsewhere.`);
  }
}

checkThumbnails()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
