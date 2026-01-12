"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVideoPreviews = exports.generatePdfThumbnail = exports.generateVideoThumbnail = exports.generateThumbnail = void 0;
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const os_1 = __importDefault(require("os"));
// --- DYNAMIC PATH CONFIGURATION ---
const platform = os_1.default.platform();
if (platform === 'linux') {
    // PRODUCTION (Linux VPS)
    fluent_ffmpeg_1.default.setFfmpegPath('/usr/bin/ffmpeg');
}
else {
    // LOCAL DEV (Windows)
    try {
        const ffmpegPath = require('ffmpeg-static');
        if (ffmpegPath)
            fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
    }
    catch (e) {
        console.warn("Could not load static ffmpeg for thumbnails.");
    }
}
// 1. IMAGES (Smart: Handles Static & Animated)
const generateThumbnail = async (filePath, outputDir) => {
    const fileName = path_1.default.basename(filePath);
    const ext = path_1.default.extname(filePath).toLowerCase();
    const nameWithoutExt = path_1.default.parse(fileName).name;
    // A. Handle GIFs (Animated WebP)
    if (ext === '.gif') {
        const thumbnailFilename = `thumb_${nameWithoutExt}.webp`;
        const thumbnailPath = path_1.default.join(outputDir, thumbnailFilename);
        await (0, sharp_1.default)(filePath, { animated: true }) // <--- Enable Animation
            .resize({ width: 400 })
            .webp({ quality: 80, effort: 4 }) // <--- Save as WebP (Better than GIF)
            .toFile(thumbnailPath);
        return `thumbnails/${thumbnailFilename}`;
    }
    // B. Handle Static Images (JPEG)
    const thumbnailFilename = `thumb_${nameWithoutExt}.jpg`;
    const thumbnailPath = path_1.default.join(outputDir, thumbnailFilename);
    await (0, sharp_1.default)(filePath)
        .resize({ width: 400 })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
    return `thumbnails/${thumbnailFilename}`;
};
exports.generateThumbnail = generateThumbnail;
// 2. VIDEOS
const generateVideoThumbnail = async (filePath, outputDir) => {
    return new Promise((resolve, reject) => {
        const fileName = path_1.default.basename(filePath);
        const nameWithoutExt = path_1.default.parse(fileName).name;
        const thumbnailFilename = `thumb_${nameWithoutExt}.jpg`;
        (0, fluent_ffmpeg_1.default)(filePath)
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
exports.generateVideoThumbnail = generateVideoThumbnail;
// 3. PDFS
const generatePdfThumbnail = async (filePath, outputDir) => {
    return null; // Return null -> Frontend shows Icon
};
exports.generatePdfThumbnail = generatePdfThumbnail;
// ✅ ADD THIS NEW FUNCTION
const generateVideoPreviews = (videoPath, outputDir, filenameBase) => {
    return new Promise((resolve, reject) => {
        const filenames = [];
        (0, fluent_ffmpeg_1.default)(videoPath)
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
            count: 10, // 📸 Take 10 snapshots
            folder: outputDir,
            filename: `${filenameBase}-scrub-%i.jpg`,
            size: '320x?', // Small size for fast loading
        });
    });
};
exports.generateVideoPreviews = generateVideoPreviews;
