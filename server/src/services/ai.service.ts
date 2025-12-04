import fs from 'fs-extra';
import OpenAI from 'openai';
import path from 'path';
import { prisma } from '../lib/prisma';
import ffmpeg from 'fluent-ffmpeg';

// --- CONFIG: USE SYSTEM BINARIES ---
// This is critical for Linux servers (VPS)
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
ffmpeg.setFfprobePath('/usr/bin/ffprobe');

// --- FORCE LOAD PDF-EXTRACTION ---
// This bypasses the TypeScript import errors for this specific legacy library
const pdfParse = require('pdf-extraction'); 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AiOptions {
  creativity: number;
  specificity: string;
}

// --- HELPER: SAVE TO DB ---
const saveAiData = async (id: string, data: any) => {
  await prisma.asset.update({
    where: { id },
    data: { aiData: JSON.stringify(data) },
  });
};

// --- HELPER: TEXT TAGGING (For PDF/Audio) ---
const getTagsFromText = async (text: string, options?: AiOptions) => {
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

// --- HELPER: VIDEO FRAME EXTRACTION ---
const extractVideoFrame = (videoPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const screenshotFilename = `frame-${Date.now()}.jpg`;
    const screenshotPath = path.join(path.dirname(videoPath), screenshotFilename);

    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['20%'], // Capture at 20% mark to skip intros
        filename: screenshotFilename,
        folder: path.dirname(videoPath),
        size: '800x?', // Resize width to 800px, maintain aspect ratio
      })
      .on('end', () => resolve(screenshotPath))
      .on('error', (err) => reject(err));
  });
};

// --- MAIN HANDLER 1: IMAGES (Vision) ---
export const analyzeImage = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
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

// --- MAIN HANDLER 2: PDF (Text Extraction) ---
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

// --- MAIN HANDLER 3: VIDEO & AUDIO ---
export const analyzeAudioVideo = async (assetId: string, filePath: string, options?: AiOptions) => {
  try {
    const stats = await fs.stat(filePath);
    
    // Guess type by extension to decide logic path
    const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(path.extname(filePath).toLowerCase());

    if (isVideo) {
      console.log(`🎥 Extracting frame for video: ${assetId}`);
      
      // A. Extract Screenshot
      const framePath = await extractVideoFrame(filePath);
      
      // B. Send to GPT-4o Vision
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
                text: `Analyze this key frame from a video. Infer the context and return a valid JSON object with:
                
                1. 'tags': array of ${isSpecific ? '15-20' : '5-10'} keywords focusing on:
                   - The specific software or tool visible (e.g., 'Articulate Storyline', 'Excel', 'Photoshop').
                   - The specific action being performed (e.g., 'Creating Variables', 'Pivot Table', 'Masking').
                   - The topic or category (e.g., 'E-Learning', 'Tutorial', 'Coding').
                
                2. 'description': A deductive summary of what is happening. 
                   - If it's a screen recording, read the visible text/menus to describe the exact task.
                   - If it's real life, describe the activity.
                
                3. 'colors': 3 dominant hex codes.` 
              },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" },
      });

      const aiData = JSON.parse(response.choices[0].message.content || '{}');
      aiData.isVideoAnalysis = true; // Flag for frontend if needed

      await saveAiData(assetId, aiData);
      
      // Cleanup Screenshot
      await fs.remove(framePath);
      console.log(`✅ Video Visual Analysis complete for ${assetId}`);

    } else {
      // It is AUDIO - Use Whisper
       if (stats.size > 25 * 1024 * 1024) {
         console.warn(`⚠️ File too large for Whisper API (Limit 25MB): ${assetId}`);
         return;
       }
       
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