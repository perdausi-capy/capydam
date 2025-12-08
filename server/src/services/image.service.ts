import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';

// --- DYNAMIC PATH CONFIGURATION ---
const platform = os.platform();

if (platform === 'linux') {
    // PRODUCTION (Linux VPS)
    ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
} else {
    // LOCAL DEV (Windows)
    try {
        const ffmpegPath = require('ffmpeg-static');
        if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
    } catch (e) {
        console.warn("Could not load static ffmpeg for thumbnails.");
    }
}

// 1. IMAGES
export const generateThumbnail = async (filePath: string, outputDir: string): Promise<string> => {
  const fileName = path.basename(filePath);
  const nameWithoutExt = path.parse(fileName).name; 
  const thumbnailFilename = `thumb_${nameWithoutExt}.jpg`;
  const thumbnailPath = path.join(outputDir, thumbnailFilename);

  await sharp(filePath)
    .resize({ width: 400 }) // Width only (Pinterest style)
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);

  return `thumbnails/${thumbnailFilename}`;
};

// 2. VIDEOS
export const generateVideoThumbnail = async (filePath: string, outputDir: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileName = path.basename(filePath);
    const nameWithoutExt = path.parse(fileName).name;
    const thumbnailFilename = `thumb_${nameWithoutExt}.jpg`;
    
    ffmpeg(filePath)
      .screenshots({
        timestamps: ['20%'], 
        filename: thumbnailFilename,
        folder: outputDir,
        size: '400x?',
      })
      .on('end', () => resolve(`thumbnails/${thumbnailFilename}`))
      .on('error', (err) => reject(err));
  });
};

// 3. PDFS
export const generatePdfThumbnail = async (filePath: string, outputDir: string): Promise<string | null> => {
  return null; // Return null -> Frontend shows Icon
};