import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
// import ffmpegPath from 'ffmpeg-static';

// Configure FFmpeg (This works fine on Node 22)
// if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

// 1. IMAGES (Sharp)
export const generateThumbnail = async (filePath: string, outputDir: string): Promise<string> => {
  const fileName = path.basename(filePath);
  const nameWithoutExt = path.parse(fileName).name; 
  const thumbnailFilename = `thumb_${nameWithoutExt}.jpg`;
  const thumbnailPath = path.join(outputDir, thumbnailFilename);

  await sharp(filePath)
    .resize({ width: 400 }) 
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);

  return `thumbnails/${thumbnailFilename}`;
};

// 2. VIDEOS (FFmpeg) - This is what we want!
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
        // CHANGE: size '400x?' tells FFmpeg to keep aspect ratio
        size: '400x?', 
      })
      .on('end', () => {
        resolve(`thumbnails/${thumbnailFilename}`);
      })
      .on('error', (err) => {
        console.error('FFmpeg thumbnail error:', err);
        reject(err);
      });
  });
};

// 3. PDFS (Skip)
export const generatePdfThumbnail = async (filePath: string, outputDir: string): Promise<string | null> => {
  // Return null so the Frontend shows the "PDF File" icon
  return null; 
};