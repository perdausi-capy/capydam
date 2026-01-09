/// <reference types="node" />

import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { Upload } from '@aws-sdk/lib-storage';
import { storageClient, BUCKET_NAME, PUBLIC_URL_BASE } from '../lib/storage';

const prisma = new PrismaClient();

async function migratePreviewFrames() {
  console.log("🚀 Starting PREVIEW FRAMES (Scrub) Migration...");

  // 1. Get all assets (Since we can't easily filter arrays for partial strings in Prisma, we fetch video assets)
  // Optimization: Only fetching videos reduces the load
  const assets = await prisma.asset.findMany({
    where: {
      mimeType: { startsWith: 'video/' }
    },
    select: { id: true, previewFrames: true } // Only fetch what we need
  });

  console.log(`Checking ${assets.length} video assets for Supabase previews...`);

  let successCount = 0;
  let errorCount = 0;

  for (const asset of assets) {
    // Skip if empty or already migrated (check the first frame)
    if (!asset.previewFrames || asset.previewFrames.length === 0) continue;
    if (!asset.previewFrames[0].includes('supabase.co')) continue;

    console.log(`\nProcessing Asset ID: ${asset.id} (${asset.previewFrames.length} frames)`);

    const newFrames: string[] = [];
    let assetHasError = false;

    // 2. Loop through every frame in the list
    for (const frameUrl of asset.previewFrames) {
      try {
        // Download
        const response = await axios({
          method: 'get',
          url: frameUrl,
          responseType: 'stream'
        });

        // Determine Filename (e.g., "previews/1468...-scrub-10.jpg")
        let destinationKey = frameUrl.split('/assets/')[1];
        if (!destinationKey) {
            destinationKey = `previews/${frameUrl.split('/').pop()}`;
        }
        destinationKey = decodeURIComponent(destinationKey);

        // Upload to MinIO
        const upload = new Upload({
          client: storageClient,
          params: {
            Bucket: BUCKET_NAME,
            Key: destinationKey,
            Body: response.data,
            ContentType: 'image/jpeg',
          },
        });

        await upload.done();

        // Add new URL to our list
        newFrames.push(`${PUBLIC_URL_BASE}/${destinationKey}`);

      } catch (error) {
        console.error(`❌ Failed to move frame: ${frameUrl}`);
        assetHasError = true;
        // Keep the old URL if migration fails so we don't break the array
        newFrames.push(frameUrl); 
      }
    }

    // 3. Update the Database with the new list
    if (!assetHasError) {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { previewFrames: newFrames }
      });
      console.log(`✅ Asset updated successfully.`);
      successCount++;
    } else {
      errorCount++;
    }
  }
  
  console.log(`\nJob Complete! ✅ Assets Updated: ${successCount} | ❌ Errors: ${errorCount}`);
}

migratePreviewFrames()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });