import fs from 'fs-extra';
import OpenAI from 'openai';
import path from 'path';
import { prisma } from '../lib/prisma';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';

// --- DYNAMIC CONFIGURATION ---
const platform = os.platform();

if (platform === 'linux') {
    console.log('🐧 Linux detected: Using system FFmpeg');
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    ffmpeg.setFfprobePath('/usr/bin/ffprobe');
} else {
    console.log('💻 Local OS detected: Using static FFmpeg');
    try {
        const ffmpegPath = require('ffmpeg-static');
        const ffprobePath = require('ffprobe-static').path;
        if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
        if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);
    } catch (e) {
        console.warn("⚠️ Could not load static ffmpeg/ffprobe.");
    }
}

const pdfParse = require('pdf-extraction'); 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60 * 1000, // Increase timeout to 60 seconds for videos
  maxRetries: 2,
});

interface AiOptions {
  creativity: number;
  specificity: string;
}

// 1. IMPROVED CACHE (With Expiry)
const queryCache = new Map<string, { terms: string[], expires: number }>();

export const expandQuery = async (term: string): Promise<string[]> => {
  // Check Cache
  const cached = queryCache.get(term);
  if (cached && cached.expires > Date.now()) {
      return cached.terms;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{
        role: "user",
        content: `Given search term "${term}", return JSON object with an array 'terms' containing 3-5 synonyms or related concepts. Example: "cat" -> ["kitten", "feline", "pet"].`
      }],
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0].message.content || '{}';
    const data = JSON.parse(content);
    const results = [term, ...(data.terms || [])]; 
    
    // Save to Cache (24 Hours TTL)
    queryCache.set(term, { 
        terms: results, 
        expires: Date.now() + (24 * 60 * 60 * 1000) 
    });
    
    // Cleanup Memory (Every 100 entries)
    if (queryCache.size > 100) {
        const now = Date.now();
        for (const [key, val] of queryCache.entries()) {
            if (val.expires < now) queryCache.delete(key);
        }
    }
    
    return results;
  } catch (e) {
    console.warn("Query expansion failed:", e);
    return [term]; 
  }
};

// --- HELPERS ---

const saveAiData = async (id: string, data: any) => {
  const textToEmbed = `${data.description || ''} ${data.tags?.join(', ') || ''} ${data.transcript || ''}`;
  const embedding = await generateEmbedding(textToEmbed);

  if (embedding) {
    await prisma.asset.update({ where: { id }, data: { aiData: JSON.stringify(data) } });
    const vectorString = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`UPDATE "Asset" SET embedding = ${vectorString}::vector WHERE id = ${id}`;
  } else {
    await prisma.asset.update({ where: { id }, data: { aiData: JSON.stringify(data) } });
  }
};

export const generateEmbedding = async (text: string) => {
  try {
    const cleanText = text.replace(/\n/g, ' ').slice(0, 8000);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
};

const getTagsFromText = async (text: string, options?: AiOptions) => {
  const safeText = text.slice(0, 10000);
  const isSpecific = options?.specificity === 'high';

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: options?.creativity || 0.2,
    messages: [
      { role: "system", content: "You are a Semantic Asset Tagger." },
      { role: "user", content: `Analyze this text:\n\n${safeText}\n\nReturn JSON: 1. tags, 2. description, 3. colors (empty).` }
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
};

const extractKeyFrames = async (videoPath: string): Promise<string[]> => {
  const screenshots: string[] = [];
  
  const absoluteVideoPath = path.resolve(videoPath);

  const duration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(absoluteVideoPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration || 0);
    });
  });

  // Timestamps at 20%, 50%, 80% (Better distribution)
  const timestamps = [duration * 0.2, duration * 0.5, duration * 0.8];

  for (let i = 0; i < timestamps.length; i++) {
    const filename = `frame-${i}-${Date.now()}.jpg`;
    const outPath = path.join(path.dirname(absoluteVideoPath), filename);
    
    await new Promise((resolve, reject) => {
      ffmpeg(absoluteVideoPath)
        .screenshots({
          timestamps: [timestamps[i]],
          filename: filename,
          folder: path.dirname(absoluteVideoPath),
          size: '400x?', // Reduced size for speed/reliability
        })
        .on('end', resolve)
        .on('error', reject);
    });
    screenshots.push(outPath);
  }
  return screenshots;
};

const encodeImage = async (p: string) => (await fs.readFile(p)).toString('base64');

// --- ANALYZERS ---

export const analyzeImage = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const base64Image = await encodeImage(filePath);
    const isSpecific = options?.specificity === 'high';
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: options?.creativity || 0.2,
      messages: [
        { role: "system", content: "You are a Visual Tagger." },
        { role: "user", content: [
            { type: "text", text: `Analyze this image. Return JSON: 1. tags (${isSpecific ? '20 precise' : '8 broad'}), 2. description, 3. colors (names).` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      response_format: { type: "json_object" },
    });
    
    const aiData = JSON.parse(response.choices[0].message.content || '{}');
    await saveAiData(assetId, aiData);
    console.log(`✅ Image Analysis complete for ${assetId}`);
  } catch (e) {
    console.error(`Image Analysis failed for ${assetId}`, e);
  }
};

export const analyzePdf = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    const aiData = await getTagsFromText(data.text, options);
    await saveAiData(assetId, aiData);
    console.log(`✅ PDF Analysis complete for ${assetId}`);
  } catch (e) {
    console.error(`PDF Analysis failed for ${assetId}`, e);
  }
};

export const analyzeAudioVideo = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const absolutePath = path.resolve(filePath);
    const stats = await fs.stat(absolutePath);
    
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(path.extname(absolutePath).toLowerCase());

    if (isVideo) {
      console.log(`🎥 Starting Deep Video Analysis for: ${assetId} (Size: ${stats.size})`);
      
      let transcript = "";
      // Only transcribe if under 25MB (OpenAI Limit)
      if (stats.size < 25 * 1024 * 1024) {
         try {
           const transcription = await openai.audio.transcriptions.create({
             file: fs.createReadStream(absolutePath),
             model: "whisper-1",
           });
           transcript = transcription.text.slice(0, 2000); 
           console.log("🎤 Audio Transcribed");
         } catch (e) { console.warn("🎤 Audio extraction skipped/failed (Silent video?)"); }
      } else {
          console.log("⚠️ Video too large for Whisper (>25MB). Skipping audio, using Visuals only.");
      }

      // Frames
      const framePaths = await extractKeyFrames(absolutePath);
      const imageContents = await Promise.all(framePaths.map(async (p) => ({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${await encodeImage(p)}` }
      })));

      const isSpecific = options?.specificity === 'high';
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3, // Lower temperature slightly for more factual/coherent writing
        messages: [
          { 
            role: "system", 
            content: `You are an expert Content Archivist and Technical Writer. 
            Your goal is to understand the **user's intent** and the **workflow** shown in the video.
            
            IMPORTANT RULES:
            1. Do NOT describe frames individually (e.g., never say "The first frame shows...").
            2. Synthesize the visual timeline and audio into a single, coherent narrative.
            3. If software is visible, read the text on screen (OCR) to identify the specific tool name, menu items clicked, and code snippets.
            4. Identify the "Goal" of the video (e.g., "A tutorial on...", "A demo of...", "A review of...").` 
          },
          { 
            role: "user", 
            content: [
              { 
                type: "text", 
                text: `CONTEXT DATA:
                - Audio Transcript: "${transcript || "No speech detected"}"
                - Domain Hint: E-Learning, Software Development, Tutorials.

                TASK:
                Analyze the 3 key frames (Start, Middle, End) and the Audio to generate metadata.
                
                RETURN JSON:
                1. 'tags': array of ${isSpecific ? '15-20' : '8-10'} keywords. Include:
                   - Software Names (e.g., Storyline, Moodle, VS Code).
                   - Technical Terms (e.g., API, Sync, Variables).
                   - Action Verbs (e.g., Configuring, Debugging, coding).
                
                2. 'description': A professional summary (2-3 sentences).
                   - Structure: "[Main Goal]. [Key Actions Taken]. [Final Outcome/State]."
                   - Example: "A technical walkthrough demonstrating how to create a survey variable in Articulate Storyline. The user configures a JavaScript trigger to sync data with a Moodle backend, using the developer console to verify the connection."
                
                3. 'colors': Array of 3 dominant color names.` 
              },
              ...imageContents as any
            ]
          }
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content || '{}';
      let aiData = JSON.parse(content);
      
      console.log("🔍 RAW AI RESPONSE:", JSON.stringify(aiData, null, 2));

      // FIX: Handle "Frames" Array structure
      if (aiData.frames && Array.isArray(aiData.frames)) {
          console.log("⚠️ Detected multi-frame response. Merging tags...");
          
          // 1. Merge all tags from all frames
          const allTags = aiData.frames.flatMap((f: any) => f.tags || []);
          // Deduplicate tags
          const uniqueTags = Array.from(new Set(allTags));

          // 2. Merge colors
          const allColors = aiData.frames.flatMap((f: any) => f.colors || []);
          const uniqueColors = Array.from(new Set(allColors)).slice(0, 5); // Keep top 5

          // 3. Create a master description (Join them or pick the longest)
          const fullDescription = aiData.frames.map((f: any) => f.description).join(' -> ');

          // Overwrite aiData with the flat structure needed by Frontend
          aiData = {
              tags: uniqueTags,
              description: fullDescription,
              colors: uniqueColors,
              frames: aiData.frames // Keep original frames if we want to debug later
          };
      }

      aiData.isVideoAnalysis = true;
      aiData.transcript = transcript; 

      await saveAiData(assetId, aiData);
      
      await Promise.all(framePaths.map(p => fs.remove(p)));
      console.log(`✅ Deep Video Analysis complete for ${assetId}`);

    } else {
       // Audio Only
       if (stats.size > 25 * 1024 * 1024) return;
       const transcription = await openai.audio.transcriptions.create({
         file: fs.createReadStream(absolutePath),
         model: "whisper-1",
       });
       const aiData = await getTagsFromText(transcription.text, options);
       await saveAiData(assetId, aiData);
       console.log(`✅ Audio Analysis complete for ${assetId}`);
    }

  } catch (e) {
    console.error(`AV Analysis failed for ${assetId}`, e);
  }
};