/// <reference types="node" />

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { Upload } from '@aws-sdk/lib-storage';
// ✅ Import changed: We are now inside src, so we go up one level (..) to lib
import { storageClient, BUCKET_NAME, PUBLIC_URL_BASE } from '../lib/storage';

const prisma = new PrismaClient();

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

      const response = await axios({
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

      const upload = new Upload({
        client: storageClient,
        params: {
          Bucket: BUCKET_NAME,
          Key: destinationKey,
          Body: response.data,
          ContentType: response.headers['content-type'],
        },
      });

      await upload.done();

      const newPath = `${PUBLIC_URL_BASE}/${destinationKey}`;
      
      await prisma.asset.update({
        where: { id: asset.id },
        data: { path: newPath }
      });

      console.log(`✅ Migrated to: ${newPath}`);
      successCount++;

    } catch (error) {
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