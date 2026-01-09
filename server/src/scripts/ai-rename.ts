import { PrismaClient } from '@prisma/client';
import { analyzeImage, analyzePdf, analyzeAudioVideo } from '../services/ai.service'; // We reuse your existing service!
import fs from 'fs';
import path from 'path';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();
const TEMP_DIR = path.join(__dirname, 'temp_rename');

// Helper to download file
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function runAiRenamer() {
  console.log('🧠 Starting AI Renamer...');

  // Ensure temp dir exists
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

  // 1. Find assets that need fixing
  const assets = await prisma.asset.findMany({
    where: {
      originalName: { startsWith: 'Resource ' }, // Only target the bad names
      // OPTIONAL: Limit to 50 at a time to save costs/time, then run again
      // take: 50 
    }
  });

  console.log(`Found ${assets.length} assets to rename.`);

  for (const asset of assets) {
    console.log(`\n🔍 Processing ID: ${asset.id} (${asset.mimeType})`);
    
    // We need a local file for the AI service to work
    const tempFilePath = path.join(TEMP_DIR, asset.filename);

    try {
      // A. Download the file locally
      await downloadFile(asset.path, tempFilePath);

      // B. Run the appropriate AI analysis
      // Note: Your AI service usually updates the DB directly!
      const aiOptions = { creativity: 0.2, specificity: 'general' };

      if (asset.mimeType.startsWith('image/')) {
         await analyzeImage(asset.id, tempFilePath, aiOptions);
      } 
      else if (asset.mimeType === 'application/pdf') {
         await analyzePdf(asset.id, tempFilePath, aiOptions);
      }
      else if (asset.mimeType.startsWith('video/')) {
         // Video analysis is heavy, maybe skip if you want to save $$
         await analyzeAudioVideo(asset.id, tempFilePath, aiOptions);
      }
      else {
         console.log('Skipping unsupported type');
         continue;
      }

      // C. Rename Logic
      // The analyze function updates 'aiData' and 'description', but usually NOT 'originalName'.
      // So we fetch the fresh data and update the name ourselves.
      const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } });
      
      if (updatedAsset && updatedAsset.aiData) {
          const aiData = JSON.parse(updatedAsset.aiData);
          
          // Use the AI-generated "Title" or "Summary" as the new name
          let newName = aiData.title || aiData.summary || "";
          
          // Truncate if too long (e.g. "A photo of a red car...") -> "Red Car on Beach"
          if (newName.length > 50) {
              newName = newName.substring(0, 50) + "...";
          }

          if (newName) {
              await prisma.asset.update({
                  where: { id: asset.id },
                  data: { originalName: newName }
              });
              console.log(`✅ Renamed to: "${newName}"`);
          }
      }

    } catch (err: any) {
      console.error(`❌ Failed: ${err.message}`);
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
  }

  console.log('\n✨ Renaming Complete!');
  if (fs.existsSync(TEMP_DIR)) fs.rmdirSync(TEMP_DIR);
}

runAiRenamer()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
