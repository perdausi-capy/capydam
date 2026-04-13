"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_URL_BASE = exports.BUCKET_NAME = exports.storageClient = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
// 1. Configuration
// ✅ SECURED: Loading from Environment Variables
const ENDPOINT = process.env.MINIO_ENDPOINT || "https://storage.capy-dev.com";
const ACCESS_KEY = process.env.MINIO_ACCESS_KEY || "admin";
const SECRET_KEY = process.env.MINIO_SECRET_KEY;
if (!SECRET_KEY) {
    console.error("❌ CRITICAL ERROR: MINIO_SECRET_KEY is missing from .env file!");
    // In production, you might want to throw an error here to prevent starting up insecurely
}
// 2. Initialize Client
exports.storageClient = new client_s3_1.S3Client({
    region: 'us-east-1', // Required by AWS SDK, ignored by MinIO
    endpoint: ENDPOINT,
    forcePathStyle: true, // Critical for MinIO (it ensures URL is endpoint/bucket/file)
    credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY || "", // Fallback empty string to prevent TS error, but logs will warn
    },
});
exports.BUCKET_NAME = 'capydam-assets';
exports.PUBLIC_URL_BASE = `${ENDPOINT}/${exports.BUCKET_NAME}`;
