"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const openai_1 = __importDefault(require("openai"));
// Load env vars
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const prisma = new client_1.PrismaClient();
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
const TEMP_DIR = path_1.default.join(__dirname, 'temp_fix_videos');
// Helper: Download file
async function downloadFile(url, dest) {
    const writer = fs_1.default.createWriteStream(dest);
    const response = await (0, axios_1.default)({ url, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}
async function main() {
    console.log('🚀 Starting "Brute Force" Video Repair...');
    // 1. Fetch ALL videos (We will filter them manually to be safe)
    const allVideos = await prisma.asset.findMany({
        where: {
            mimeType: { startsWith: 'video/' }
        },
        select: {
            id: true,
            filename: true,
            path: true,
            originalName: true,
            aiData: true,
            keywords: true
        }
    });
    console.log(`📂 Scanned ${allVideos.length} total videos in database.`);
    // 2. Filter for TRULY broken assets
    const assetsToFix = allVideos.filter(asset => {
        // Check 1: Is the keywords array empty?
        if (!asset.keywords || asset.keywords.length === 0)
            return true;
        // Check 2: Does aiData exist?
        if (!asset.aiData)
            return true;
        // Check 3: Is aiData valid JSON and does it contain tags?
        try {
            const parsed = JSON.parse(asset.aiData);
            if (!parsed.tags || !Array.isArray(parsed.tags) || parsed.tags.length === 0) {
                return true; // JSON exists but has no tags
            }
        }
        catch (e) {
            return true; // Invalid JSON
        }
        return false; // Asset is healthy
    });
    console.log(`🔍 Found ${assetsToFix.length} videos that ACTUALLY need fixing.`);
    if (assetsToFix.length === 0) {
        console.log("✅ Your library is 100% clean!");
        return;
    }
    // Ensure temp directory exists
    if (!fs_1.default.existsSync(TEMP_DIR))
        fs_1.default.mkdirSync(TEMP_DIR, { recursive: true });
    // 3. Process the list
    for (const asset of assetsToFix) {
        console.log(`\n================================================`);
        console.log(`🎬 Fixing: ${asset.originalName}`);
        const localFilePath = path_1.default.join(TEMP_DIR, asset.filename);
        const localFileDir = path_1.default.dirname(localFilePath);
        if (!fs_1.default.existsSync(localFileDir))
            fs_1.default.mkdirSync(localFileDir, { recursive: true });
        try {
            // A. Download
            console.log(`   ⬇️  Downloading...`);
            await downloadFile(asset.path, localFilePath);
            // B. Extract Frame (Using robust percentage)
            const screenshotName = `thumb-${asset.id}.jpg`;
            const screenshotPath = path_1.default.join(localFileDir, screenshotName);
            await new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(localFilePath)
                    .screenshots({
                    timestamps: ['20%'],
                    filename: screenshotName,
                    folder: localFileDir,
                    size: '640x?'
                })
                    .on('end', resolve)
                    .on('error', reject);
            });
            // C. AI Analysis
            if (fs_1.default.existsSync(screenshotPath)) {
                console.log(`   🤖 Sending to OpenAI...`);
                const imageBuffer = fs_1.default.readFileSync(screenshotPath);
                const base64Image = imageBuffer.toString('base64');
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "Analyze this video frame. Return JSON with keys: 'tags' (array), 'description' (string)." },
                        { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }] }
                    ],
                    response_format: { type: "json_object" }
                });
                const aiResult = JSON.parse(response.choices[0].message.content || '{}');
                const tags = aiResult.tags || [];
                const description = aiResult.description || "";
                if (tags.length > 0) {
                    // D. Force Update Database
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: {
                            keywords: tags,
                            description: description,
                            aiData: JSON.stringify(aiResult)
                        }
                    });
                    console.log(`   ✅ FIXED! Added ${tags.length} tags.`);
                }
                else {
                    console.warn(`   ⚠️ AI returned 0 tags (Video might be blank).`);
                }
            }
            else {
                console.error(`   ❌ Could not extract screenshot.`);
            }
        }
        catch (err) {
            console.error(`   🔥 Error: ${err.message}`);
        }
        finally {
            if (fs_1.default.existsSync(localFilePath))
                fs_1.default.unlinkSync(localFilePath);
        }
    }
    // Cleanup
    if (fs_1.default.existsSync(TEMP_DIR))
        fs_1.default.rmdirSync(TEMP_DIR, { recursive: true });
    console.log('\n🎉 Repair Complete! Refresh your dashboard.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
