import fs from 'fs-extra';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Import the client we just created in src/lib/storage.ts
import { storageClient, BUCKET_NAME, PUBLIC_URL_BASE } from '../lib/storage';

/**
 * UPLOADS a file to your Self-Hosted MinIO Server.
 * * NOTE: The function name is kept as 'uploadToSupabase' so we don't 
 * have to rewrite your entire Asset Controller. It now points to MinIO.
 */
export const uploadToSupabase = async (
  localFilePath: string, 
  destinationPath: string, 
  mimeType: string
): Promise<string> => {
  try {
    // 1. Read file from local disk
    const fileBuffer = await fs.readFile(localFilePath);

    // 2. Upload to MinIO (S3 Compatible)
    await storageClient.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: destinationPath, // e.g., "originals/my-photo.jpg"
      Body: fileBuffer,
      ContentType: mimeType,
      // ACL: 'public-read' // Optional: Depends on your bucket policy
    }));

    // 3. Return the Public URL
    // Result: https://storage.capy-dev.com/capydam-assets/originals/my-photo.jpg
    // This string is what gets saved into your Prisma Database.
    return `${PUBLIC_URL_BASE}/${destinationPath}`;

  } catch (error) {
    console.error('❌ Storage Upload Error:', error);
    throw new Error('Failed to upload to cloud storage');
  }
};

/**
 * DELETES a file from MinIO.
 */
export const deleteFromSupabase = async (pathUrl: string): Promise<void> => {
  try {
    // 1. Extract the file key (relative path) from the full URL
    // Example Input: https://storage.capy-dev.com/capydam-assets/originals/image.jpg
    // We need just: "originals/image.jpg"
    let fileKey = pathUrl;
    
    // Split by the bucket name to find the relative part
    if (pathUrl.includes(`${BUCKET_NAME}/`)) {
      const parts = pathUrl.split(`${BUCKET_NAME}/`);
      if (parts.length > 1) {
        fileKey = parts[1];
      }
    }

    // 2. Send Delete Command
    await storageClient.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    }));

  } catch (error) {
    console.error('⚠️ Storage Delete Error:', error);
    // We do NOT throw an error here, so the controller keeps running 
    // even if the file was already missing.
  }
};