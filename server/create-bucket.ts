import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'CAPYDAM2025',
  },
  forcePathStyle: true,
});

async function run() {
  try {
    const bucket = 'capydam-assets';
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Successfully created bucket: ${bucket}`);
  } catch (err) {
    console.error('Error creating bucket:', err);
  }
}

run();
