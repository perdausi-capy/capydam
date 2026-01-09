import { S3Client } from '@aws-sdk/client-s3';

// 1. Configuration
// (In a perfect world, these go in your .env file, but this works for now)
const ENDPOINT = "https://storage.capy-dev.com";
const ACCESS_KEY = "admin";
const SECRET_KEY = "CAPYDAM2025"; // ✅ Matches your Docker password

// 2. Initialize Client
export const storageClient = new S3Client({
  region: 'us-east-1', // Required by SDK, ignored by MinIO
  endpoint: ENDPOINT,
  forcePathStyle: true, // Critical for MinIO
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

export const BUCKET_NAME = 'capydam-assets';
export const PUBLIC_URL_BASE = `${ENDPOINT}/${BUCKET_NAME}`;