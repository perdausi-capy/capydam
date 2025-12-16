"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeAudioVideo = exports.analyzePdf = exports.analyzeImage = exports.generateEmbedding = exports.expandQuery = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const openai_1 = __importDefault(require("openai"));
const path_1 = __importDefault(require("path"));
const prisma_1 = require("../lib/prisma");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const os_1 = __importDefault(require("os"));
// --- 1. DYNAMIC CONFIGURATION ---
const platform = os_1.default.platform();
if (platform === 'linux') {
    // PRODUCTION (VPS)
    console.log('🐧 Linux detected: Using system FFmpeg');
    fluent_ffmpeg_1.default.setFfmpegPath('/usr/bin/ffmpeg');
    fluent_ffmpeg_1.default.setFfprobePath('/usr/bin/ffprobe');
}
else {
    // LOCAL (Windows/Mac)
    console.log('💻 Local OS detected: Using static FFmpeg');
    try {
        const ffmpegPath = require('ffmpeg-static');
        const ffprobePath = require('ffprobe-static').path;
        if (ffmpegPath)
            fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
        if (ffprobePath)
            fluent_ffmpeg_1.default.setFfprobePath(ffprobePath);
    }
    catch (e) {
        console.warn("⚠️ Could not load static ffmpeg/ffprobe.");
    }
}
const pdfParse = require('pdf-extraction');
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 90 * 1000,
    maxRetries: 2,
});
const VALID_COLORS = "Red, Orange, Yellow, Green, Teal, Blue, Purple, Pink, Black, White, Gray";
// --- 2. SYSTEM PROMPTS (Instructional Design Specialized) ---
const IMAGE_SYSTEM_PROMPT = `You are an expert Visual Analyst for Instructional Design.
Your goal is to categorize assets for use in e-learning courses (Storyline, Rise, Captivate).
COLORS: Use ONLY [${VALID_COLORS}].`;
const VIDEO_SYSTEM_PROMPT = `You are an expert Video Content Analyst for E-Learning.
Your goal is to describe the instructional value, pacing, and content of videos/GIFs.
COLORS: Use ONLY [${VALID_COLORS}].`;
// --- 3. SEARCH EXPANSION ---
const queryCache = new Map();
const expandQuery = async (term) => {
    const cached = queryCache.get(term);
    if (cached && cached.expires > Date.now())
        return cached.terms;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.3,
            messages: [{
                    role: "user",
                    content: `Given search term "${term}" in an EdTech context, return JSON with 'terms' array (3-5 synonyms). Example: "tutorial" -> ["walkthrough", "demonstration", "guide"].`
                }],
            response_format: { type: "json_object" }
        });
        const data = JSON.parse(response.choices[0].message.content || '{}');
        const results = [term, ...(data.terms || [])];
        queryCache.set(term, { terms: results, expires: Date.now() + (24 * 60 * 60 * 1000) });
        return results;
    }
    catch (e) {
        return [term];
    }
};
exports.expandQuery = expandQuery;
// --- 4. EMBEDDINGS ---
const generateEmbedding = async (text) => {
    try {
        const cleanText = text.replace(/\n/g, ' ').slice(0, 8000);
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: cleanText,
            encoding_format: "float",
        });
        return response.data[0].embedding;
    }
    catch (error) {
        return null;
    }
};
exports.generateEmbedding = generateEmbedding;
// --- 5. DB HELPERS ---
const saveAiData = async (id, data) => {
    // Combine all text fields for the vector embedding
    const textToEmbed = `${data.description || ''} ${data.tags?.join(', ') || ''} ${data.educationalContext || ''} ${data.transcript || ''}`;
    const embedding = await (0, exports.generateEmbedding)(textToEmbed);
    if (embedding) {
        await prisma_1.prisma.asset.update({ where: { id }, data: { aiData: JSON.stringify(data) } });
        const vectorString = `[${embedding.join(',')}]`;
        await prisma_1.prisma.$executeRaw `UPDATE "Asset" SET embedding = ${vectorString}::vector WHERE id = ${id}`;
    }
    else {
        await prisma_1.prisma.asset.update({ where: { id }, data: { aiData: JSON.stringify(data) } });
    }
};
const extractKeyFrames = async (videoPath) => {
    const screenshots = [];
    const absoluteVideoPath = path_1.default.resolve(videoPath);
    const duration = await new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(absoluteVideoPath, (err, metadata) => {
            if (err)
                return reject(err);
            const d = parseFloat(metadata.format.duration);
            resolve(isNaN(d) ? 0 : d);
        });
    });
    let timestamps = [];
    if (duration > 0) {
        // Extract more frames if video is long
        if (duration > 60)
            timestamps = [duration * 0.1, duration * 0.5, duration * 0.9];
        else
            timestamps = [duration * 0.2, duration * 0.8];
    }
    else {
        timestamps = [0];
    }
    for (let i = 0; i < timestamps.length; i++) {
        const filename = `frame-${i}-${Date.now()}.jpg`;
        const outPath = path_1.default.join(path_1.default.dirname(absoluteVideoPath), filename);
        await new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(absoluteVideoPath)
                .screenshots({ timestamps: [timestamps[i]], filename, folder: path_1.default.dirname(absoluteVideoPath), size: '400x?' })
                .on('end', resolve)
                .on('error', reject);
        });
        screenshots.push(outPath);
    }
    return screenshots;
};
const encodeImage = async (p) => (await fs_extra_1.default.readFile(p)).toString('base64');
// --- 6. ANALYZERS ---
// A. IMAGE (With Slider Logic)
const analyzeImage = async (assetId, filePath, options) => {
    try {
        const base64Image = await encodeImage(filePath);
        const isSpecific = options?.specificity === 'high';
        const userPrompt = isSpecific
            ? `Analyze this image in high detail for e-learning use.
         Return JSON:
         1. 'tags': 20-25 precise keywords (Objects, Style, Technical).
         2. 'description': Detailed breakdown of composition and utility.
         3. 'colors': 3 standard color names.
         4. 'educationalContext': "How can this be used in training?"
         5. 'storylineUseCase': "Specific slide suggestion (e.g. 'Background', 'Character')."`
            : `Analyze this image generally.
         Return JSON:
         1. 'tags': 8-10 broad categories.
         2. 'description': Brief summary.
         3. 'colors': 3 standard color names.`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            // SLIDER CONNECTED HERE: 0.0 (Robot) -> 1.0 (Creative)
            temperature: options?.creativity || 0.4,
            messages: [
                { role: "system", content: IMAGE_SYSTEM_PROMPT },
                { role: "user", content: [
                        { type: "text", text: userPrompt },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }
            ],
            response_format: { type: "json_object" },
        });
        const aiData = JSON.parse(response.choices[0].message.content || '{}');
        aiData.assetType = 'image';
        await saveAiData(assetId, aiData);
        console.log(`✅ Image Analysis complete (Spec: ${options?.specificity}, Temp: ${options?.creativity})`);
    }
    catch (e) {
        console.error(e);
    }
};
exports.analyzeImage = analyzeImage;
// B. PDF
const analyzePdf = async (assetId, filePath, options) => {
    try {
        const dataBuffer = await fs_extra_1.default.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        const textSample = data.text.slice(0, 12000);
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: options?.creativity || 0.2,
            messages: [
                { role: "system", content: "You are an Instructional Design Archivist." },
                { role: "user", content: `Analyze this document text. Return JSON: { "tags": [], "description": "Summary", "educationalContext": "Topic" }\n\n${textSample}` }
            ],
            response_format: { type: "json_object" }
        });
        const aiData = JSON.parse(response.choices[0].message.content || '{}');
        aiData.assetType = 'document';
        await saveAiData(assetId, aiData);
        console.log(`✅ PDF Analysis complete`);
    }
    catch (e) {
        console.error(e);
    }
};
exports.analyzePdf = analyzePdf;
// C. VIDEO / GIF (With Slider Logic)
const analyzeAudioVideo = async (assetId, filePath, options) => {
    try {
        const absolutePath = path_1.default.resolve(filePath);
        const stats = await fs_extra_1.default.stat(absolutePath);
        const ext = path_1.default.extname(absolutePath).toLowerCase();
        const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.gif'].includes(ext);
        if (isVideo) {
            console.log(`🎥 Starting Motion Analysis for: ${assetId}`);
            let transcript = "";
            const isGif = ext === '.gif';
            if (!isGif && stats.size < 25 * 1024 * 1024) {
                try {
                    const transcription = await openai.audio.transcriptions.create({
                        file: fs_extra_1.default.createReadStream(absolutePath),
                        model: "whisper-1",
                    });
                    transcript = transcription.text;
                }
                catch (e) { /* ignore */ }
            }
            else if (isGif) {
                transcript = "[Animated GIF - Visuals Only]";
            }
            const framePaths = await extractKeyFrames(absolutePath);
            const imageContents = await Promise.all(framePaths.map(async (p) => ({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${await encodeImage(p)}` }
            })));
            const isSpecific = options?.specificity === 'high';
            const userPrompt = isSpecific
                ? `Analyze these frames + transcript in DEPTH.
           Return JSON:
           1. 'tags': 20+ keywords (Action, Software, Instructional method).
           2. 'description': Detailed step-by-step or narrative summary.
           3. 'colors': 3 standard names.
           4. 'instructionalApproach': (e.g. "Demo", "Scenario").`
                : `Analyze these frames + transcript GENERALLY.
           Return JSON:
           1. 'tags': 8-10 broad topics.
           2. 'description': Brief summary.
           3. 'colors': 3 names.`;
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                // SLIDER CONNECTED HERE
                temperature: options?.creativity || 0.3,
                messages: [
                    { role: "system", content: VIDEO_SYSTEM_PROMPT },
                    { role: "user", content: [
                            { type: "text", text: `Context: Transcript: "${transcript.slice(0, 2000)}"\n${userPrompt}` },
                            ...imageContents
                        ]
                    }
                ],
                response_format: { type: "json_object" },
            });
            let aiData = JSON.parse(response.choices[0].message.content || '{}');
            // Flatten frames if AI gets confused
            if (aiData.frames) {
                aiData.tags = aiData.frames.flatMap((f) => f.tags);
                aiData.description = aiData.frames.map((f) => f.description).join(' ');
                delete aiData.frames;
            }
            aiData.isVideoAnalysis = true;
            aiData.transcript = transcript;
            await saveAiData(assetId, aiData);
            await Promise.all(framePaths.map(p => fs_extra_1.default.remove(p)));
            console.log(`✅ Motion Analysis complete`);
        }
    }
    catch (e) {
        console.error(`AV Analysis failed`, e);
    }
};
exports.analyzeAudioVideo = analyzeAudioVideo;
