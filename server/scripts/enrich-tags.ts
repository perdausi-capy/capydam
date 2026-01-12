import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';

// 1. Load Environment Variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

if (!process.env.OPENAI_API_KEY) {
    console.error("❌ ERROR: OPENAI_API_KEY is missing from .env");
    process.exit(1);
}

// 2. Configure FFmpeg (Auto-detect paths if needed)
// On standard Linux servers (like CS6), this usually works automatically.
// If it fails, uncomment the lines below and point to where ffmpeg is installed.
// ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
// ffmpeg.setFfprobePath('/usr/bin/ffprobe');

// 3. Initialize Clients
const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 90000, // 90s timeout (videos take longer)
});

// --- CONFIGURATION ---
const KEYWORD_THRESHOLD = 3;  
const BATCH_SIZE = 3;         // Reduced batch size (video processing is heavy)
const DELAY_MS = 2000;        

// --- HELPERS ---
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Download Remote File to Temp Disk (Required for FFmpeg)
const downloadToTemp = async (url: string, ext: string): Promise<string> => {
    const tempPath = path.join(os.tmpdir(), `temp-${Date.now()}${ext}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(tempPath, buffer);
    return tempPath;
};

// Helper: Extract 3 Frames from Video
const extractFrames = async (videoPath: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        const screenshots: string[] = [];
        const folder = os.tmpdir();
        const prefix = `frame-${Date.now()}`;
        
        ffmpeg(videoPath)
            .on('end', () => {
                // Return paths to the 3 generated images
                resolve([
                    path.join(folder, `${prefix}_1.jpg`),
                    path.join(folder, `${prefix}_2.jpg`),
                    path.join(folder, `${prefix}_3.jpg`)
                ]);
            })
            .on('error', (err) => reject(err))
            .screenshots({
                count: 3,           // Take 3 snapshots
                folder: folder,
                filename: `${prefix}_%i.jpg`,
                size: '640x?',      // Resize to save tokens/bandwidth
            });
    });
};

// Helper: Encode Local File to Base64
const encodeImage = async (inputPath: string): Promise<string> => {
    return (await fs.promises.readFile(inputPath)).toString('base64');
};

// --- CORE: AI ANALYSIS FUNCTIONS ---

const IMAGE_PROMPT = "Analyze this image. Return JSON: { tags: string[], description: string, educationalContext: string }";
const VIDEO_PROMPT = "Analyze these 3 keyframes from a video. Return JSON: { tags: string[], description: string, educationalContext: string }";

// 1. Analyze Image
async function analyzeImage(base64Image: string) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "You are an Instructional Design Asset Analyst. Return JSON." },
        { role: "user", content: [
            { type: "text", text: IMAGE_PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]}
      ],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content || '{}');
}

// 2. Analyze Video (Multi-frame)
async function analyzeVideoFrames(framePaths: string[]) {
    const contentPayload: any[] = [{ type: "text", text: VIDEO_PROMPT }];
    
    // Attach all 3 frames to the prompt
    for (const framePath of framePaths) {
        if (fs.existsSync(framePath)) {
            const b64 = await encodeImage(framePath);
            contentPayload.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } });
        }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "You are an Instructional Design Video Analyst. Return JSON." },
        { role: "user", content: contentPayload }
      ],
      response_format: { type: "json_object" },
    });
    return JSON.parse(response.choices[0].message.content || '{}');
}


// --- MAIN SCRIPT ---
async function main() {
  console.log('🚀 Starting Universal AI Tag Enrichment (Images + Videos)...');

  // Count target assets
  const totalAssets = await prisma.asset.count({
      where: { 
          OR: [
              { mimeType: { startsWith: 'image/' } },
              { mimeType: { startsWith: 'video/' } }
          ]
      } 
  });
  console.log(`📂 Total media assets in DB: ${totalAssets}`);

  let skip = 0;
  let hasMore = true;
  let processedCount = 0;
  let updatedCount = 0;

  while (hasMore) {
    const assets = await prisma.asset.findMany({
      where: { 
          OR: [
              { mimeType: { startsWith: 'image/' } },
              { mimeType: { startsWith: 'video/' } }
          ]
      },
      take: BATCH_SIZE,
      skip: skip,
      orderBy: { createdAt: 'desc' },
    });

    if (assets.length === 0) {
      hasMore = false;
      break;
    }

    for (const asset of assets) {
      const currentKeywords = asset.keywords || [];

      // Check Threshold
      if (currentKeywords.length < KEYWORD_THRESHOLD) {
        
        console.log(`Processing: ${asset.originalName} (${asset.mimeType})...`);
        let aiResult = null;
        let tempVideoPath: string | null = null;
        let tempFrames: string[] = [];

        try {
            // --- BRANCH A: VIDEO ---
            if (asset.mimeType.startsWith('video/')) {
                const ext = path.extname(asset.filename) || '.mp4';
                
                // 1. Determine Path (Local or Remote)
                if (asset.path.startsWith('http')) {
                    console.log(`   ⬇️ Downloading video to temp...`);
                    tempVideoPath = await downloadToTemp(asset.path, ext);
                } else {
                    // Try to resolve local path
                    const localPath = path.resolve(__dirname, '../', asset.path);
                    if (fs.existsSync(localPath)) tempVideoPath = localPath;
                    else {
                        // Attempt one level up
                         const altPath = path.resolve(__dirname, '../../', asset.path);
                         if (fs.existsSync(altPath)) tempVideoPath = altPath;
                    }
                }

                if (!tempVideoPath || (asset.path.startsWith('http') && !fs.existsSync(tempVideoPath))) {
                    console.warn(`   ⚠️ Could not access video file.`);
                    continue;
                }

                // 2. Extract Frames
                console.log(`   📸 Extracting keyframes...`);
                tempFrames = await extractFrames(tempVideoPath);

                // 3. Analyze Frames
                console.log(`   🤖 Analyzing frames with AI...`);
                aiResult = await analyzeVideoFrames(tempFrames);
            } 
            
            // --- BRANCH B: IMAGE ---
            else if (asset.mimeType.startsWith('image/')) {
                let base64 = '';
                if (asset.path.startsWith('http')) {
                    const resp = await fetch(asset.path);
                    const buf = await resp.arrayBuffer();
                    base64 = Buffer.from(buf).toString('base64');
                } else {
                    const localPath = path.resolve(__dirname, '../../', asset.path); // Adjusted relative path guess
                    if (fs.existsSync(localPath)) {
                        base64 = await encodeImage(localPath);
                    } else {
                        // try fallback
                        const fallback = path.resolve(__dirname, '../', asset.path);
                         if (fs.existsSync(fallback)) base64 = await encodeImage(fallback);
                    }
                }

                if (base64) {
                    aiResult = await analyzeImage(base64);
                } else {
                    console.warn(`   ⚠️ Local image file missing.`);
                }
            }

            // --- SAVE RESULTS ---
            if (aiResult && aiResult.tags) {
                const combined = Array.from(new Set([...currentKeywords, ...aiResult.tags]));
                
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: {
                        keywords: combined,
                        aiData: JSON.stringify(aiResult)
                    }
                });
                console.log(`   ✅ Enriched! Tags: ${currentKeywords.length} -> ${combined.length}`);
                updatedCount++;
            } else {
                console.log(`   Rx No tags generated.`);
            }

        } catch (error) {
            console.error(`   ❌ Failed:`, error);
        } finally {
            // Cleanup Temp Files
            if (tempFrames.length > 0) {
                tempFrames.forEach(f => fs.unlink(f, () => {}));
            }
            // Only delete temp video if we downloaded it (starts with /tmp or similar logic)
            if (tempVideoPath && tempVideoPath.includes('temp-') && fs.existsSync(tempVideoPath)) {
                fs.unlink(tempVideoPath, () => {});
            }
            
            await wait(DELAY_MS);
        }
      }
    }

    skip += BATCH_SIZE;
    processedCount += assets.length;
    console.log(`--- Processed ${processedCount} assets ---`);
  }

  console.log(`\n🎉 Job Complete! Updated ${updatedCount} assets.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
