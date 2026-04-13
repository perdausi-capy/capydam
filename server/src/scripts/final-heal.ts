import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const MAP_PATH = '/var/www/capydam/server/src/scripts/live_recovered_links.json';

async function runHeal() {
    const data = JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8'));
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
            } else {
                skipped++;
            }
        }
    }
    console.log(`\n✨ MISSION COMPLETE!`);
    console.log(`✅ Successfully Healed: ${updated} assets.`);
    console.log(`⏭️  Skipped (Already Linked): ${skipped} assets.`);
}

runHeal().finally(() => prisma.$disconnect());
