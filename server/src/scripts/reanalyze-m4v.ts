import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const TEMP_DIR = path.join(__dirname, 'temp_fix_videos');

// Helper: Download file
async function downloadFile(url: string, dest: string): Promise<void> {
  const writer = fs.createWriteStream(dest);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function main() {
  console.log('🚀 Starting "Brute Force" Video Repair...');

  // 1. Fetch ALL videos (We will filter them manually to be safe)
  const allVideos = await prisma.asset.findMany({
    where: {
      mimeType: { startsWith: 'video/' }
    },
    select: {
        id: true,
        filename: true,
        path: true,
        originalName: true,
        aiData: true,
        keywords: true
    }
  });

  console.log(`📂 Scanned ${allVideos.length} total videos in database.`);

  // 2. Filter for TRULY broken assets
  const assetsToFix = allVideos.filter(asset => {
      // Check 1: Is the keywords array empty?
      if (!asset.keywords || asset.keywords.length === 0) return true;

      // Check 2: Does aiData exist?
      if (!asset.aiData) return true;

      // Check 3: Is aiData valid JSON and does it contain tags?
      try {
          const parsed = JSON.parse(asset.aiData);
          if (!parsed.tags || !Array.isArray(parsed.tags) || parsed.tags.length === 0) {
              return true; // JSON exists but has no tags
          }
      } catch (e) {
          return true; // Invalid JSON
      }

      return false; // Asset is healthy
  });

  console.log(`🔍 Found ${assetsToFix.length} videos that ACTUALLY need fixing.`);

  if (assetsToFix.length === 0) {
    console.log("✅ Your library is 100% clean!");
    return;
  }

  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  // 3. Process the list
  for (const asset of assetsToFix) {
    console.log(`\n================================================`);
    console.log(`🎬 Fixing: ${asset.originalName}`);

    const localFilePath = path.join(TEMP_DIR, asset.filename);
    const localFileDir = path.dirname(localFilePath);
    if (!fs.existsSync(localFileDir)) fs.mkdirSync(localFileDir, { recursive: true });

    try {
      // A. Download
      console.log(`   ⬇️  Downloading...`);
      await downloadFile(asset.path, localFilePath);

      // B. Extract Frame (Using robust percentage)
      const screenshotName = `thumb-${asset.id}.jpg`;
      const screenshotPath = path.join(localFileDir, screenshotName);

      await new Promise((resolve, reject) => {
        ffmpeg(localFilePath)
          .screenshots({
            timestamps: ['20%'], 
            filename: screenshotName,
            folder: localFileDir,
            size: '640x?'
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // C. AI Analysis
      if (fs.existsSync(screenshotPath)) {
        console.log(`   🤖 Sending to OpenAI...`);
        const imageBuffer = fs.readFileSync(screenshotPath);
        const base64Image = imageBuffer.toString('base64');

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "Analyze this video frame. Return JSON with keys: 'tags' (array), 'description' (string)." },
              { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }] }
            ],
            response_format: { type: "json_object" }
        });

        const aiResult = JSON.parse(response.choices[0].message.content || '{}');
        const tags = aiResult.tags || [];
        const description = aiResult.description || "";

        if (tags.length > 0) {
            // D. Force Update Database
            await prisma.asset.update({
                where: { id: asset.id },
                data: {
                    keywords: tags,
                    description: description,
                    aiData: JSON.stringify(aiResult)
                }
            });
            console.log(`   ✅ FIXED! Added ${tags.length} tags.`);
        } else {
            console.warn(`   ⚠️ AI returned 0 tags (Video might be blank).`);
        }
      } else {
        console.error(`   ❌ Could not extract screenshot.`);
      }

    } catch (err: any) {
      console.error(`   🔥 Error: ${err.message}`);
    } finally {
      if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
    }
  }

  // Cleanup
  if (fs.existsSync(TEMP_DIR)) fs.rmdirSync(TEMP_DIR, { recursive: true });
  console.log('\n🎉 Repair Complete! Refresh your dashboard.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
