"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUBLIC_URL_BASE = exports.BUCKET_NAME = exports.storageClient = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
// 1. Configuration
// (In a perfect world, these go in your .env file, but this works for now)
const ENDPOINT = "https://storage.capy-dev.com";
const ACCESS_KEY = "admin";
const SECRET_KEY = "CAPYDAM2025"; // ✅ Matches your Docker password
// 2. Initialize Client
exports.storageClient = new client_s3_1.S3Client({
    region: 'us-east-1', // Required by SDK, ignored by MinIO
    endpoint: ENDPOINT,
    forcePathStyle: true, // Critical for MinIO
    credentials: {
        accessKeyId: ACCESS_KEY,
        secretAccessKey: SECRET_KEY,
    },
});
exports.BUCKET_NAME = 'capydam-assets';
exports.PUBLIC_URL_BASE = `${ENDPOINT}/${exports.BUCKET_NAME}`;
