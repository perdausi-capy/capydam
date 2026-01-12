"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ai_service_1 = require("../services/ai.service"); // We reuse your existing service!
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const TEMP_DIR = path_1.default.join(__dirname, 'temp_rename');
// Helper to download file
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs_1.default.createWriteStream(dest);
        https_1.default.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Download failed: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs_1.default.unlink(dest, () => { });
            reject(err);
        });
    });
}
async function runAiRenamer() {
    console.log('🧠 Starting AI Renamer...');
    // Ensure temp dir exists
    if (!fs_1.default.existsSync(TEMP_DIR))
        fs_1.default.mkdirSync(TEMP_DIR);
    // 1. Find assets that need fixing
    const assets = await prisma.asset.findMany({
        where: {
            originalName: { startsWith: 'Resource ' }, // Only target the bad names
            // OPTIONAL: Limit to 50 at a time to save costs/time, then run again
            // take: 50 
        }
    });
    console.log(`Found ${assets.length} assets to rename.`);
    for (const asset of assets) {
        console.log(`\n🔍 Processing ID: ${asset.id} (${asset.mimeType})`);
        // We need a local file for the AI service to work
        const tempFilePath = path_1.default.join(TEMP_DIR, asset.filename);
        try {
            // A. Download the file locally
            await downloadFile(asset.path, tempFilePath);
            // B. Run the appropriate AI analysis
            // Note: Your AI service usually updates the DB directly!
            const aiOptions = { creativity: 0.2, specificity: 'general' };
            if (asset.mimeType.startsWith('image/')) {
                await (0, ai_service_1.analyzeImage)(asset.id, tempFilePath, aiOptions);
            }
            else if (asset.mimeType === 'application/pdf') {
                await (0, ai_service_1.analyzePdf)(asset.id, tempFilePath, aiOptions);
            }
            else if (asset.mimeType.startsWith('video/')) {
                // Video analysis is heavy, maybe skip if you want to save $$
                await (0, ai_service_1.analyzeAudioVideo)(asset.id, tempFilePath, aiOptions);
            }
            else {
                console.log('Skipping unsupported type');
                continue;
            }
            // C. Rename Logic
            // The analyze function updates 'aiData' and 'description', but usually NOT 'originalName'.
            // So we fetch the fresh data and update the name ourselves.
            const updatedAsset = await prisma.asset.findUnique({ where: { id: asset.id } });
            if (updatedAsset && updatedAsset.aiData) {
                const aiData = JSON.parse(updatedAsset.aiData);
                // Use the AI-generated "Title" or "Summary" as the new name
                let newName = aiData.title || aiData.summary || "";
                // Truncate if too long (e.g. "A photo of a red car...") -> "Red Car on Beach"
                if (newName.length > 50) {
                    newName = newName.substring(0, 50) + "...";
                }
                if (newName) {
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { originalName: newName }
                    });
                    console.log(`✅ Renamed to: "${newName}"`);
                }
            }
        }
        catch (err) {
            console.error(`❌ Failed: ${err.message}`);
        }
        finally {
            // Cleanup temp file
            if (fs_1.default.existsSync(tempFilePath))
                fs_1.default.unlinkSync(tempFilePath);
        }
    }
    console.log('\n✨ Renaming Complete!');
    if (fs_1.default.existsSync(TEMP_DIR))
        fs_1.default.rmdirSync(TEMP_DIR);
}
runAiRenamer()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
