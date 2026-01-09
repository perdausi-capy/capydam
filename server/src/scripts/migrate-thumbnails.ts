/// <reference types="node" />

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { Upload } from '@aws-sdk/lib-storage';
import { storageClient, BUCKET_NAME, PUBLIC_URL_BASE } from '../lib/storage';

const prisma = new PrismaClient();

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
    if (!asset.thumbnailPath) continue;

    try {
      const currentUrl = asset.thumbnailPath;
      console.log(`\nProcessing Thumbnail: ${currentUrl}`);

      // 2. Download Thumbnail
      const response = await axios({
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
      const upload = new Upload({
        client: storageClient,
        params: {
          Bucket: BUCKET_NAME,
          Key: destinationKey,
          Body: response.data,
          ContentType: response.headers['content-type'] || 'image/jpeg',
        },
      });

      await upload.done();

      // 5. Update Database
      const newPath = `${PUBLIC_URL_BASE}/${destinationKey}`;
      
      await prisma.asset.update({
        where: { id: asset.id },
        data: { thumbnailPath: newPath }
      });

      console.log(`✅ Migrated to: ${newPath}`);
      successCount++;

    } catch (error) {
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