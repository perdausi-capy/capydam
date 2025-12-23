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

// 1. IMAGES (Smart: Handles Static & Animated)
export const generateThumbnail = async (filePath: string, outputDir: string): Promise<string> => {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const nameWithoutExt = path.parse(fileName).name; 

  // A. Handle GIFs (Animated WebP)
  if (ext === '.gif') {
      const thumbnailFilename = `thumb_${nameWithoutExt}.webp`;
      const thumbnailPath = path.join(outputDir, thumbnailFilename);

      await sharp(filePath, { animated: true }) // <--- Enable Animation
        .resize({ width: 400 })
        .webp({ quality: 80, effort: 4 }) // <--- Save as WebP (Better than GIF)
        .toFile(thumbnailPath);

      return `thumbnails/${thumbnailFilename}`;
  }

  // B. Handle Static Images (JPEG)
  const thumbnailFilename = `thumb_${nameWithoutExt}.jpg`;
  const thumbnailPath = path.join(outputDir, thumbnailFilename);

  await sharp(filePath)
    .resize({ width: 400 }) 
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

// ✅ ADD THIS NEW FUNCTION
export const generateVideoPreviews = (videoPath: string, outputDir: string, filenameBase: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const filenames: string[] = [];
    
    ffmpeg(videoPath)
      .on('filenames', (fnames) => {
        // fluent-ffmpeg returns an array of filenames
        fnames.forEach((f) => filenames.push(f));
      })
      .on('end', () => {
        resolve(filenames);
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(err);
      })
      .screenshots({
        count: 10,             // 📸 Take 10 snapshots
        folder: outputDir,
        filename: `${filenameBase}-scrub-%i.jpg`,
        size: '320x?',         // Small size for fast loading
      });
  });
};