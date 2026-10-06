import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { 
  uploadToSupabase
} from '../services/storage.service';
import { 
  generateVideoThumbnail, 
  generateVideoPreviews
} from '../services/image.service';
import { 
  analyzeAudioVideo 
} from '../services/ai.service';

// --- In-Memory Queue to prevent server overload ---
const uploadQueue: (() => Promise<void>)[] = [];
let isProcessingQueue = false;

const processUploadQueue = async () => {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  while (uploadQueue.length > 0) {
    const task = uploadQueue.shift();
    if (task) {
      try {
        await task();
      } catch (err) {
        console.error('[Webhook Queue] Task failed:', err);
      }
    }
  }
  
  isProcessingQueue = false;
};
// --------------------------------------------------

export const handleDriveUpload = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      event,
      project_name,
      clip_slug,
      clip_title,
      gdrive_url,
      gdrive_download_url,
      duration_sec,
      accent_color,
      start_text,
      timestamp
    } = req.body;

    if (event !== 'clip_exported' || !gdrive_download_url) {
       res.status(400).json({ error: 'Invalid payload or missing download URL' });
       return;
    }

    console.log(`[Webhook] Received automated upload for: ${clip_title}`);

    // Find the first admin user to assign this asset to
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' }
    });

    if (!adminUser) {
      console.error('[Webhook] No admin user found to assign asset.');
       res.status(500).json({ error: 'No admin user found' });
       return;
    }

    // Acknowledge receipt immediately to avoid client timeout!
    res.status(202).json({ success: true, message: 'Processing queued in background' });

    // Enqueue the heavy lifting so we don't overload the server
    uploadQueue.push(async () => {
      try {
        // 1. Download file from Google Drive
        const tempDir = path.join(__dirname, '../../uploads');
        await fs.ensureDir(tempDir);
        const tempFilename = `webhook-${Date.now()}.mp4`;
        const tempPath = path.join(tempDir, tempFilename);

        console.log(`[Webhook Queue] Starting processing for: ${clip_title}`);
        console.log(`[Webhook Queue] Downloading from Google Drive to ${tempPath}...`);
        
        const writer = fs.createWriteStream(tempPath);
        const gdriveResponse = await axios({
          url: gdrive_download_url,
          method: 'GET',
          responseType: 'stream'
        });

        gdriveResponse.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', () => resolve(true));
          writer.on('error', reject);
        });

        console.log(`[Webhook Queue] Download complete. Generating thumbnails...`);

        const stats = await fs.stat(tempPath);
        const size = stats.size;
        const mimetype = 'video/mp4';
        const finalOriginalName = `${clip_title}.mp4`;

        // 2. Generate Thumbnails and Previews
        const thumbnailDir = path.join(__dirname, '../../uploads/thumbnails');
        await fs.ensureDir(thumbnailDir);
        
        let thumbnailRelativePath: string | null = null;
        let previewFrames: string[] = [];

        try {
          thumbnailRelativePath = await generateVideoThumbnail(tempPath, thumbnailDir);
          const previewFiles = await generateVideoPreviews(tempPath, thumbnailDir, tempFilename);
          
          for (const pFile of previewFiles) {
              const localPPath = path.join(thumbnailDir, pFile);
              const cloudPPath = await uploadToSupabase(
                  localPPath, 
                  `previews/${pFile}`, 
                  'image/jpeg'
              );
              previewFrames.push(cloudPPath);
              await fs.remove(localPPath); // Cleanup local frame
          }
        } catch (err) {
          console.warn("[Webhook Queue] Thumbnail generation failed:", err);
        }

        // 3. Upload to Supabase
        const cloudOriginalPath = await uploadToSupabase(
          tempPath, 
          `originals/${tempFilename}`, 
          mimetype
        );

        let cloudThumbnailPath = null;
        if (thumbnailRelativePath) {
           const localThumbPath = path.join(__dirname, '../../uploads/', thumbnailRelativePath);
           cloudThumbnailPath = await uploadToSupabase(
             localThumbPath,
             thumbnailRelativePath, 
             'image/jpeg'
           );
           await fs.remove(localThumbPath);
        }

        // 4. Save to Database
        const description = `Project: ${project_name}\nGDrive URL: ${gdrive_url}\nStart Text: ${start_text}`;
        const initialAiData = {
            description: 'Processing video...',
            tags: [project_name, "automated_upload", clip_slug],
            colors: [accent_color]
        };

        const asset = await prisma.asset.create({
          data: {
            filename: tempFilename,
            originalName: finalOriginalName,
            mimeType: mimetype,
            size,
            path: cloudOriginalPath,
            thumbnailPath: cloudThumbnailPath,
            previewFrames: previewFrames,
            description: description,
            userId: adminUser.id, 
            aiData: JSON.stringify(initialAiData),
            isCReel: true, // Marked as CReel automatically
            creelFolder: project_name, // Organizes the asset into the correct folder automatically
          },
        });

        // 5. Trigger AI Analysis
        console.log(`[Webhook Queue] Triggering AI Analysis for ${asset.id}...`);
        
        try {
          await analyzeAudioVideo(asset.id, tempPath, { creativity: 0.3, specificity: 'high' });
          console.log(`✅ [Webhook Queue] AI Analysis Finished for ${asset.id}`);
        } catch (err) {
          console.error(`[Webhook Queue] AI analysis failed for ${asset.id}:`, err);
        } finally {
          // Cleanup temp file after analysis
          try {
            await new Promise(resolve => setTimeout(resolve, 500));
            if (await fs.pathExists(tempPath)) {
              await fs.remove(tempPath);
              console.log(`[Webhook Queue] Cleaned up ${tempPath}`);
            }
          } catch(e) {
            console.error(`[Webhook Queue] Error cleaning up ${tempPath}:`, e);
          }
        }

      } catch (error) {
        console.error("[Webhook Queue] Task processing failed:", error);
      }
    });

    // Start the queue processor if it's not already running
    processUploadQueue();

  } catch (error) {
    console.error("[Webhook] Handle Drive Upload Exception:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Webhook initialization failed' });
    }
  }
};
