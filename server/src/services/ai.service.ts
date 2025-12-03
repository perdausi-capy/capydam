import fs from 'fs-extra';
import OpenAI from 'openai';
import path from 'path';
import { prisma } from '../lib/prisma';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

const ffprobeInstaller = require('ffprobe-static');
const pdfParse = require('pdf-extraction');

// Tell fluent-ffmpeg where the binary is
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
// Tell fluent-ffmpeg where ffprobe is
if (ffprobeInstaller.path) {
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
}



const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AiOptions {
  creativity: number;
  specificity: string;
}



// --- SHARED: TEXT TAGGING HELPER ---
// Once we have text (from PDF or Audio), we use this to get tags
const getTagsFromText = async (text: string, options?: AiOptions) => {
  // Truncate text if it's too huge (save tokens)
  const safeText = text.slice(0, 4000); 

  const isSpecific = options?.specificity === 'high';
  const tagInstruction = isSpecific 
      ? "1. 'tags': array of 15-20 highly precise keywords."
      : "1. 'tags': array of 5-8 broad categories.";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: options?.creativity || 0.2,
    messages: [
      { role: "system", content: "You are a Digital Asset Manager. Output valid JSON." },
      { role: "user", content: `Analyze this text content and generate metadata:\n\nTEXT START:\n${safeText}\nTEXT END\n\nReturn JSON with:\n${tagInstruction}\n2. 'description': summary (max 1 sentence).\n3. 'colors': [] (return empty array for text).` }
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content || '{}');
};

// --- HANDLER 1: IMAGES (Vision) ---
export const analyzeImage = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
    // ... (Your existing Vision Prompt Logic) ...
    const isSpecific = options?.specificity === 'high';
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: options?.creativity || 0.2,
      messages: [
        { role: "system", content: "You are a Digital Asset Manager. Output valid JSON." },
        { role: "user", content: [
            { type: "text", text: `Analyze this image. Return JSON with tags (${isSpecific ? 'specific' : 'general'}), description, and colors.` },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" },
    });
    
    const aiData = JSON.parse(response.choices[0].message.content || '{}');
    await saveAiData(assetId, aiData);
  } catch (e) {
    console.error(`Image Analysis failed for ${assetId}`, e);
  }
};

// --- HANDLER 2: PDF (Text Extraction) ---
export const analyzePdf = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const dataBuffer = await fs.readFile(filePath);
    
    // Simple direct call - pdf-extraction is reliable
    const data = await pdfParse(dataBuffer);
    
    // Send extracted text to GPT
    const aiData = await getTagsFromText(data.text, options);
    await saveAiData(assetId, aiData);
    console.log(`✅ PDF Analysis complete for ${assetId}`);
  } catch (e) {
    console.error(`PDF Analysis failed for ${assetId}`, e);
  }
};

// Helper: Extract a screenshot from the video at the 1-second mark
const extractVideoFrame = (videoPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Create a temporary path for the screenshot
    const screenshotFilename = `frame-${Date.now()}.jpg`;
    const screenshotPath = path.join(path.dirname(videoPath), screenshotFilename);

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['20%'], // Take a screenshot at 20% into the video (skips intros)
        filename: screenshotFilename,
        folder: path.dirname(videoPath),
        size: '800x?', // Resize to save tokens, keep aspect ratio
      })
      .on('end', () => resolve(screenshotPath))
      .on('error', (err) => reject(err));
  });
};

// --- HANDLER 3: VIDEO (Visual Frame Extraction) ---
export const analyzeAudioVideo = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const stats = await fs.stat(filePath);
    
    // 1. Is it Audio or Video?
    // We can guess by extension or just try to extract a frame.
    // If it's pure audio (mp3), extracting a frame will fail, so we fall back to Whisper.
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv'].includes(path.extname(filePath).toLowerCase());

    if (isVideo) {
      console.log(`🎥 Extracting frame for video: ${assetId}`);
      
      // Step A: Extract Screenshot
      const framePath = await extractVideoFrame(filePath);
      
      // Step B: Send Screenshot to GPT-4o Vision (Reuse our Image Logic!)
      // We manually construct the call here to allow custom prompting if needed
      const imageBuffer = await fs.readFile(framePath);
      const base64Image = imageBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      const isSpecific = options?.specificity === 'high';
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: options?.creativity || 0.2,
        messages: [
          { 
            role: "system", 
            content: "You are an expert Video Content Analyst. Your goal is to identify the **activity**, **software**, and **intent** shown in the video frame." 
          },
          { 
            role: "user", 
            content: [
              { 
                type: "text", 
                // 👇 THIS IS THE NEW "SHERLOCK HOLMES" PROMPT
                text: `Analyze this key frame from a video. Infer the context and return a valid JSON object with:
                
                1. 'tags': array of ${isSpecific ? '15-20' : '5-10'} keywords focusing on:
                   - The specific software or tool visible (e.g., 'Articulate Storyline', 'Excel', 'Photoshop').
                   - The specific action being performed (e.g., 'Creating Variables', 'Pivot Table', 'Masking').
                   - The topic or category (e.g., 'E-Learning', 'Tutorial', 'Coding').
                
                2. 'description': A deductive summary of what is happening. 
                   - If it's a screen recording, read the visible text/menus to describe the exact task (e.g., "User is opening the variables pane in Storyline 360").
                   - If it's real life, describe the activity (e.g., "A person is demonstrating how to replace a tire").
                
                3. 'colors': 3 dominant hex codes.` 
              },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" },
      });

      const aiData = JSON.parse(response.choices[0].message.content || '{}');
      
      // Add a flag so we know it was video processed
      aiData.isVideoAnalysis = true;

      await saveAiData(assetId, aiData);
      
      // Cleanup: Delete the temporary screenshot
      await fs.remove(framePath);
      console.log(`✅ Video Visual Analysis complete for ${assetId}`);

    } else {
      // It is AUDIO (MP3, WAV) - Use Whisper
      // ... (Keep your old Whisper logic here for Audio files) ...
       if (stats.size > 25 * 1024 * 1024) return;
       const transcription = await openai.audio.transcriptions.create({
         file: fs.createReadStream(filePath),
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

// Helper to save to DB
const saveAiData = async (id: string, data: any) => {
  await prisma.asset.update({
    where: { id },
    data: { aiData: JSON.stringify(data) },
  });
};