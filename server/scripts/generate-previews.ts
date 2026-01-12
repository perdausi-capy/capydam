import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { generateVideoPreviews } from '../src/services/image.service'; 
import { uploadToSupabase } from '../src/services/storage.service';     

const prisma = new PrismaClient();

// Helper: Download file from URL to local path
async function downloadFile(url: string, destPath: string): Promise<void> {
  const writer = fs.createWriteStream(destPath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve()); 
    writer.on('error', reject);
  });
}

async function main() {
  console.log('🎬 Starting Video Preview Migration...');

  // 1. Find all videos
  const videos = await prisma.asset.findMany({
    where: {
      mimeType: { startsWith: 'video/' },
    },
  });

  // 2. Filter for videos that don't have previews yet
  const videosToProcess = videos.filter(v => !v.previewFrames || v.previewFrames.length === 0);

  console.log(`🔍 Found ${videosToProcess.length} videos to process.`);

  // Define base temp directory
  const tempDir = path.join(__dirname, '../../uploads/temp_migration');
  await fs.ensureDir(tempDir);

  for (const video of videosToProcess) {
    console.log(`\n-----------------------------------`);
    console.log(`Processing: ${video.originalName} (ID: ${video.id})`);

    // ✅ FIX: Determine full local path, including any subfolders in the filename
    const localVideoPath = path.join(tempDir, video.filename);

    try {
      // ✅ FIX: Ensure the specific subdirectory exists (e.g., if filename is 'migration/video.mp4')
      await fs.ensureDir(path.dirname(localVideoPath));

      // A. Download Video
      console.log(`   ⬇️ Downloading to ${localVideoPath}...`);
      if (!video.path) throw new Error("No video URL found");
      
      await downloadFile(video.path, localVideoPath);

      // B. Generate Frames
      console.log(`   📸 Generating 10 frames...`);
      // We pass the *directory* of the local video to store frames next to it
      // But we want the output in the main tempDir to keep things simple for upload
      // So we pass 'tempDir' as the output folder, but use 'path.basename' for the file prefix
      const frameFilenames = await generateVideoPreviews(localVideoPath, tempDir, path.basename(video.filename));

      // C. Upload Frames
      console.log(`   ☁️ Uploading to Supabase...`);
      const cloudFrameUrls: string[] = [];

      for (const frameFile of frameFilenames) {
        const localFramePath = path.join(tempDir, frameFile);
        
        const cloudUrl = await uploadToSupabase(
            localFramePath, 
            `previews/${frameFile}`, 
            'image/jpeg'
        );
        
        cloudFrameUrls.push(cloudUrl);
        
        // Cleanup individual frame
        await fs.remove(localFramePath); 
      }

      // D. Update Database
      console.log(`   💾 Updating Database...`);
      await prisma.asset.update({
        where: { id: video.id },
        data: { previewFrames: cloudFrameUrls }
      });

      console.log(`   ✅ Done!`);

    } catch (error) {
      console.error(`   ❌ Failed:`, error);
    } finally {
      // Cleanup the big video file after processing
      if (await fs.pathExists(localVideoPath)) {
        await fs.remove(localVideoPath);
      }
    }
  }

  // Final Cleanup of the entire temp directory
  await fs.remove(tempDir);
  console.log('\n🎉 Migration Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
