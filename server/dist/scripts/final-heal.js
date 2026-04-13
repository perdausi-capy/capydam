"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const prisma = new client_1.PrismaClient();
const MAP_PATH = '/var/www/capydam/server/src/scripts/live_recovered_links.json';
async function runHeal() {
    const data = JSON.parse(fs_1.default.readFileSync(MAP_PATH, 'utf-8'));
    const filenames = Object.keys(data);
    console.log(`🩹 Preparing to heal database using ${filenames.length} live links...`);
    let updated = 0;
    let skipped = 0;
    for (const filename of filenames) {
        const link = data[filename];
        // Find the asset by its exact original name
        const assets = await prisma.asset.findMany({
            where: { originalName: filename }
        });
        for (const asset of assets) {
            let aiDataObj = JSON.parse(asset.aiData || '{}');
            // Only update if it's missing the link OR we want to force the correct one
            if (!aiDataObj.externalLink || aiDataObj.externalLink !== link) {
                aiDataObj.externalLink = link;
                aiDataObj.links = [link];
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: { aiData: JSON.stringify(aiDataObj) }
                });
                updated++;
                console.log(`✅ Linked: ${filename}`);
            }
            else {
                skipped++;
            }
        }
    }
    console.log(`\n✨ MISSION COMPLETE!`);
    console.log(`✅ Successfully Healed: ${updated} assets.`);
    console.log(`⏭️  Skipped (Already Linked): ${skipped} assets.`);
}
runHeal().finally(() => prisma.$disconnect());
