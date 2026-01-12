"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromSupabase = exports.uploadToSupabase = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const client_s3_1 = require("@aws-sdk/client-s3");
// Import the client we just created in src/lib/storage.ts
const storage_1 = require("../lib/storage");
/**
 * UPLOADS a file to your Self-Hosted MinIO Server.
 * * NOTE: The function name is kept as 'uploadToSupabase' so we don't
 * have to rewrite your entire Asset Controller. It now points to MinIO.
 */
const uploadToSupabase = async (localFilePath, destinationPath, mimeType) => {
    try {
        // 1. Read file from local disk
        const fileBuffer = await fs_extra_1.default.readFile(localFilePath);
        // 2. Upload to MinIO (S3 Compatible)
        await storage_1.storageClient.send(new client_s3_1.PutObjectCommand({
            Bucket: storage_1.BUCKET_NAME,
            Key: destinationPath, // e.g., "originals/my-photo.jpg"
            Body: fileBuffer,
            ContentType: mimeType,
            // ACL: 'public-read' // Optional: Depends on your bucket policy
        }));
        // 3. Return the Public URL
        // Result: https://storage.capy-dev.com/capydam-assets/originals/my-photo.jpg
        // This string is what gets saved into your Prisma Database.
        return `${storage_1.PUBLIC_URL_BASE}/${destinationPath}`;
    }
    catch (error) {
        console.error('❌ Storage Upload Error:', error);
        throw new Error('Failed to upload to cloud storage');
    }
};
exports.uploadToSupabase = uploadToSupabase;
/**
 * DELETES a file from MinIO.
 */
const deleteFromSupabase = async (pathUrl) => {
    try {
        // 1. Extract the file key (relative path) from the full URL
        // Example Input: https://storage.capy-dev.com/capydam-assets/originals/image.jpg
        // We need just: "originals/image.jpg"
        let fileKey = pathUrl;
        // Split by the bucket name to find the relative part
        if (pathUrl.includes(`${storage_1.BUCKET_NAME}/`)) {
            const parts = pathUrl.split(`${storage_1.BUCKET_NAME}/`);
            if (parts.length > 1) {
                fileKey = parts[1];
            }
        }
        // 2. Send Delete Command
        await storage_1.storageClient.send(new client_s3_1.DeleteObjectCommand({
            Bucket: storage_1.BUCKET_NAME,
            Key: fileKey,
        }));
    }
    catch (error) {
        console.error('⚠️ Storage Delete Error:', error);
        // We do NOT throw an error here, so the controller keeps running 
        // even if the file was already missing.
    }
};
exports.deleteFromSupabase = deleteFromSupabase;
