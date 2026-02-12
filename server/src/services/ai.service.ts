import fs from 'fs-extra';
import OpenAI from 'openai';
import path from 'path';
import { prisma } from '../lib/prisma';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';

// --- 1. DYNAMIC CONFIGURATION ---
const platform = os.platform();

if (platform === 'linux') {
    // PRODUCTION (VPS)
    console.log('🐧 Linux detected: Using system FFmpeg');
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    ffmpeg.setFfprobePath('/usr/bin/ffprobe');
} else {
    // LOCAL (Windows/Mac)
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
  timeout: 90 * 1000, 
  maxRetries: 2,
});

const VALID_COLORS = "Red, Orange, Yellow, Green, Teal, Blue, Purple, Pink, Black, White, Gray";

interface AiOptions {
  creativity: number;
  specificity: string;
}

// --- 2. SYSTEM PROMPTS (Instructional Design Specialized) ---

const IMAGE_SYSTEM_PROMPT = `You are an expert Visual Analyst for Instructional Design.
Your goal is to categorize assets for use in e-learning courses (Storyline, Rise, Captivate).
COLORS: Use ONLY [${VALID_COLORS}].`;

const VIDEO_SYSTEM_PROMPT = `You are an expert Video Content Analyst for E-Learning.
Your goal is to describe the instructional value, pacing, and content of videos/GIFs.
COLORS: Use ONLY [${VALID_COLORS}].`;

// --- 3. SEARCH EXPANSION ---
const queryCache = new Map<string, { terms: string[], expires: number }>();

export const expandQuery = async (term: string): Promise<string[]> => {
  const cached = queryCache.get(term);
  if (cached && cached.expires > Date.now()) return cached.terms;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [{
        role: "user",
        content: `Given search term "${term}" in an EdTech context, return JSON with 'terms' array (3-5 synonyms). Example: "tutorial" -> ["walkthrough", "demonstration", "guide"].`
      }],
      response_format: { type: "json_object" }
    });
    
    const data = JSON.parse(response.choices[0].message.content || '{}');
    const results = [term, ...(data.terms || [])]; 
    queryCache.set(term, { terms: results, expires: Date.now() + (24 * 60 * 60 * 1000) });
    return results;
  } catch (e) { return [term]; }
};

// --- 4. EMBEDDINGS ---
export const generateEmbedding = async (text: string) => {
  try {
    const cleanText = text.replace(/\n/g, ' ').slice(0, 8000);
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
      encoding_format: "float",
    });
    return response.data[0].embedding;
  } catch (error) { return null; }
};

// --- 5. DB HELPERS ---
const saveAiData = async (id: string, data: any) => {
  // Combine all text fields for the vector embedding
  const textToEmbed = `${data.description || ''} ${data.tags?.join(', ') || ''} ${data.educationalContext || ''} ${data.transcript || ''}`;
  const embedding = await generateEmbedding(textToEmbed);

  if (embedding) {
    await prisma.asset.update({ where: { id }, data: { aiData: JSON.stringify(data) } });
    const vectorString = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`UPDATE "Asset" SET embedding = ${vectorString}::vector WHERE id = ${id}`;
  } else {
    await prisma.asset.update({ where: { id }, data: { aiData: JSON.stringify(data) } });
  }
};

// ✅ UPDATED: Robust Keyframe Extraction (Fixes .m4v empty tags)
const extractKeyFrames = async (videoPath: string): Promise<string[]> => {
  const screenshots: string[] = [];
  const absoluteVideoPath = path.resolve(videoPath);

  // 1. Try to get Duration
  const duration = await new Promise<number>((resolve) => {
    ffmpeg.ffprobe(absoluteVideoPath, (err, metadata) => {
      // If error or missing duration, return 0
      if (err || !metadata || !metadata.format || !metadata.format.duration) {
          resolve(0);
          return;
      }
      const d = parseFloat(metadata.format.duration as any);
      resolve(isNaN(d) ? 0 : d);
    });
  });

  // 2. Decide Timestamps (Use Percentages if duration fails!)
  let timestamps: (number | string)[] = [];
  
  if (duration > 0) {
      // Good metadata? Use exact seconds
      if (duration > 60) {
          timestamps = [duration * 0.1, duration * 0.5, duration * 0.9];
      } else {
          timestamps = [duration * 0.2, duration * 0.8];
      }
  } else {
      // ⚠️ FIX: If duration is 0 (common with .m4v), use percentages!
      // This forces FFmpeg to scan the file stream instead of relying on broken metadata.
      console.log("⚠️ Duration not detected. Using percentage fallbacks for AI frames.");
      timestamps = ['20%', '50%', '80%']; 
  }

  // 3. Extract Frames
  for (let i = 0; i < timestamps.length; i++) {
    const filename = `frame-${i}-${Date.now()}.jpg`;
    const outPath = path.join(path.dirname(absoluteVideoPath), filename);
    
    await new Promise((resolve, reject) => {
      ffmpeg(absoluteVideoPath)
        .screenshots({ 
            // ✅ FIX: Wrap in String() or template literal
            timestamps: [String(timestamps[i])], 
            filename, 
            folder: path.dirname(absoluteVideoPath), 
            size: '400x?' 
        })
        .on('end', resolve)
        .on('error', (err) => {
            console.warn(`Frame ${i} extraction failed:`, err);
            resolve(null); // Continue even if one frame fails
        });
    });

    // Only add if file was actually created
    if (await fs.pathExists(outPath)) {
        screenshots.push(outPath);
    }
  }

  if (screenshots.length === 0) {
      console.error("❌ No frames extracted for AI analysis.");
  }

  return screenshots;
};

const encodeImage = async (p: string) => (await fs.readFile(p)).toString('base64');

// --- 6. ANALYZERS ---

// A. IMAGE (With Slider Logic)
export const analyzeImage = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const base64Image = await encodeImage(filePath);
    const isSpecific = options?.specificity === 'high';
    
    const userPrompt = isSpecific 
      ? `Analyze this image in high detail for e-learning use.
         Return JSON:
         1. 'tags': 20-25 precise keywords (Objects, Style, Technical).
         2. 'description': Detailed breakdown of composition and utility.
         3. 'colors': 3 standard color names.
         4. 'educationalContext': "How can this be used in training?"
         5. 'storylineUseCase': "Specific slide suggestion (e.g. 'Background', 'Character')."`
      : `Analyze this image generally.
         Return JSON:
         1. 'tags': 8-10 broad categories.
         2. 'description': Brief summary.
         3. 'colors': 3 standard color names.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      // SLIDER CONNECTED HERE: 0.0 (Robot) -> 1.0 (Creative)
      temperature: options?.creativity || 0.4, 
      messages: [
        { role: "system", content: IMAGE_SYSTEM_PROMPT },
        { role: "user", content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      response_format: { type: "json_object" },
    });
    
    const aiData = JSON.parse(response.choices[0].message.content || '{}');
    aiData.assetType = 'image';
    await saveAiData(assetId, aiData);
    console.log(`✅ Image Analysis complete (Spec: ${options?.specificity}, Temp: ${options?.creativity})`);
    
    return aiData;
    
  } catch (e) { 
    console.error(e);  
    return null; // Return null on failure
  }
};

// B. PDF
export const analyzePdf = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    const textSample = data.text.slice(0, 12000);
    
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: options?.creativity || 0.2,
        messages: [
            { role: "system", content: "You are an Instructional Design Archivist." },
            { role: "user", content: `Analyze this document text. Return JSON: { "tags": [], "description": "Summary", "educationalContext": "Topic" }\n\n${textSample}` }
        ],
        response_format: { type: "json_object" }
    });
    const aiData = JSON.parse(response.choices[0].message.content || '{}');
    aiData.assetType = 'document';
    await saveAiData(assetId, aiData);
    console.log(`✅ PDF Analysis complete`);
  } catch (e) { console.error(e); }
};

// C. VIDEO / GIF (With Slider Logic)
export const analyzeAudioVideo = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const absolutePath = path.resolve(filePath);
    const stats = await fs.stat(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase();
    
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.gif', '.m4v'].includes(ext);

    if (isVideo) {
      console.log(`🎥 Starting Motion Analysis for: ${assetId}`);
      
      let transcript = "";
      const isGif = ext === '.gif';

      if (!isGif && stats.size < 25 * 1024 * 1024) {
         try {
           const transcription = await openai.audio.transcriptions.create({
             file: fs.createReadStream(absolutePath),
             model: "whisper-1",
           });
           transcript = transcription.text;
         } catch (e) { /* ignore */ }
      } else if (isGif) {
          transcript = "[Animated GIF - Visuals Only]";
      }

      const framePaths = await extractKeyFrames(absolutePath);
      const imageContents = await Promise.all(framePaths.map(async (p) => ({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${await encodeImage(p)}` }
      })));

      const isSpecific = options?.specificity === 'high';
      const userPrompt = isSpecific
        ? `Analyze these frames + transcript in DEPTH.
           Return JSON:
           1. 'tags': 20+ keywords (Action, Software, Instructional method).
           2. 'description': Detailed step-by-step or narrative summary.
           3. 'colors': 3 standard names.
           4. 'instructionalApproach': (e.g. "Demo", "Scenario").`
        : `Analyze these frames + transcript GENERALLY.
           Return JSON:
           1. 'tags': 8-10 broad topics.
           2. 'description': Brief summary.
           3. 'colors': 3 names.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        // SLIDER CONNECTED HERE
        temperature: options?.creativity || 0.3,
        messages: [
          { role: "system", content: VIDEO_SYSTEM_PROMPT },
          { role: "user", content: [
              { type: "text", text: `Context: Transcript: "${transcript.slice(0, 2000)}"\n${userPrompt}` },
              ...imageContents as any
            ]
          }
        ],
        response_format: { type: "json_object" },
      });

      let aiData = JSON.parse(response.choices[0].message.content || '{}');
      
      // Flatten frames if AI gets confused
      if (aiData.frames) {
          aiData.tags = aiData.frames.flatMap((f:any) => f.tags);
          aiData.description = aiData.frames.map((f:any) => f.description).join(' ');
          delete aiData.frames;
      }

      aiData.isVideoAnalysis = true;
      aiData.transcript = transcript; 

      await saveAiData(assetId, aiData);
      await Promise.all(framePaths.map(p => fs.remove(p)));
      console.log(`✅ Motion Analysis complete`);

    }
  } catch (e) { console.error(`AV Analysis failed`, e); }
};

// --- 7. QUEST & IMPORT TOOLS ---

export const generateQuestWithAI = async (topic: string = "Instructional Design, E-Learning, or Creative Tech") => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { 
          role: "system", 
          content: `You are a Trivia Master for a creative tech agency. 
          Generate a "Question of the Day".
          Output JSON ONLY format:
          {
            "question": "The question text?",
            "options": [
              { "text": "Option A", "isCorrect": false },
              { "text": "Option B", "isCorrect": true },
              { "text": "Option C", "isCorrect": false },
              { "text": "Option D", "isCorrect": false }
            ]
          }
          Keep it witty, short, and engaging.` 
        },
        { role: "user", content: `Generate a question about ${topic}.` }
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error("AI Quest Gen Error:", error);
    return null;
  }
};

// ✅ HELPER: Split text intelligently by newlines to avoid cutting sentences
// ✅ SMARTER SPLITTER: Respects "Question Blocks" by looking for double newlines
function splitTextIntoChunks(text: string, maxChunkSize: number = 4000): string[] {
  // 1. Normalize line endings to ensure \n\n is consistent
  const normalizedText = text.replace(/\r\n/g, '\n');
  
  // 2. Split by "Double Newline" (Paragraphs/Blocks) first
  // This keeps "Question + Options" together in 99% of cases
  const paragraphs = normalizedText.split(/\n\s*\n/);
  
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    // If a single paragraph is HUGE (bigger than chunk limit), we forced to split it by lines
    // But usually, a question block is small (< 500 chars)
    if (para.length > maxChunkSize) {
        // Fallback: Split massive paragraph by single lines
        const lines = para.split('\n');
        for (const line of lines) {
             if ((currentChunk.length + line.length) > maxChunkSize) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            currentChunk += line + '\n';
        }
    } else {
        // Normal case: Add paragraph if it fits
        if ((currentChunk.length + para.length) > maxChunkSize) {
            chunks.push(currentChunk);
            currentChunk = '';
        }
        currentChunk += para + '\n\n'; // Re-add the double newline spacing
    }
  }
  
  if (currentChunk.trim().length > 0) chunks.push(currentChunk);
  
  return chunks;
}

// ✅ UPDATED: Chunked Parsing Function (Parallel & Safe)
export const parseQuestionsWithAI = async (rawText: string) => {
  try {
    // 1. Split the massive text into safe chunks (approx 4000 chars)
    const chunks = splitTextIntoChunks(rawText, 4000);
    
    console.log(`🚀 Splitting import into ${chunks.length} chunks to prevent timeouts...`);

    // 2. Define the AI Worker for a single chunk
    const processChunk = async (chunkText: string, index: number) => {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", 
          temperature: 0.2, // Low temp for strict parsing
          messages: [
            { 
              role: "system", 
              content: `You are a Data Parsing Assistant. 
              Extract questions from the text and return a JSON ARRAY.
              Format: [{"question": "...", "options": [{"text": "...", "isCorrect": true}]}]
              If options are missing, generate plausible ones.
              Output JSON ONLY.` 
            },
            { role: "user", content: `Extract questions from this section:\n\n${chunkText}` }
          ],
          response_format: { type: "json_object" },
        });

        const content = JSON.parse(response.choices[0].message.content || '{}');
        // Handle variations where AI wraps result in { "questions": [...] }
        const result = content.questions || content;
        
        console.log(`   ✅ Chunk ${index + 1}/${chunks.length} processed (${Array.isArray(result) ? result.length : 0} items)`);
        
        // Ensure we always return an array
        return Array.isArray(result) ? result : [];
      } catch (err) {
        console.error(`   ❌ Chunk ${index + 1} failed:`, err);
        return []; // Return empty array so one failure doesn't crash the whole job
      }
    };

    // 3. Execute ALL chunks in parallel (The Speed Boost ⚡)
    const results = await Promise.all(chunks.map((chunk, i) => processChunk(chunk, i)));

    // 4. Flatten the array of arrays into one giant list
    const allQuestions = results.flat();

    console.log(`✨ AI Import Complete. Total parsed: ${allQuestions.length}`);
    return allQuestions;

  } catch (error) {
    console.error("AI Parse Error:", error);
    return null; // Return null so controller handles the error gracefully
  }
};