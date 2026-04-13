"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
const TSV_PATH = '/var/www/capydam/server/src/scripts/all_live_links.tsv';
// Normalizes a string: "My_File-Name 01.mp4" -> "myfilename01"
function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}
async function runFuzzyHeal() {
    console.log("🕵️  Starting Fuzzy Matcher...");
    // 1. Read TSV and build a normalized map
    const rawData = fs_1.default.readFileSync(TSV_PATH, 'utf-8');
    const lines = rawData.split('\n');
    const fuzzyMap = {};
    for (const line of lines) {
        const [filename, driveUrl] = line.split('\t');
        if (filename && driveUrl && driveUrl.includes('drive.google.com')) {
            // Strip extensions and special characters for a pure core-name match
            const coreName = normalize(filename.split('.')[0]);
            fuzzyMap[coreName] = driveUrl;
        }
    }
    // 2. Find assets in CapyDAM that are still missing links
    const assets = await prisma.asset.findMany();
    let updatedCount = 0;
    for (const asset of assets) {
        let aiDataObj = asset.aiData ? JSON.parse(asset.aiData) : {};
        // If it already has a link, skip it
        if (aiDataObj.externalLink)
            continue;
        // Normalize the CapyDAM filename
        const coreCapyName = normalize(asset.originalName.split('.')[0]);
        // Look for a fuzzy match
        if (fuzzyMap[coreCapyName]) {
            const driveUrl = fuzzyMap[coreCapyName];
            aiDataObj.externalLink = driveUrl;
            aiDataObj.links = [driveUrl];
            await prisma.asset.update({
                where: { id: asset.id },
                data: { aiData: JSON.stringify(aiDataObj) }
            });
            updatedCount++;
            console.log(`🪄 Fuzzy Matched: ${asset.originalName}`);
        }
    }
    console.log(`\n🎉 Fuzzy Match Complete! Recovered ${updatedCount} additional links.`);
}
runFuzzyHeal().finally(() => prisma.$disconnect());
