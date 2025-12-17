import { PrismaClient } from '@prisma/client';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ⚠️ OLD DATABASE CONFIG
const oldDbConfig = {
    host: 'localhost',
    user: 'resourcespace_rw',
    password: 'your_rw_password',
    database: 'resourcespace'
};

// 🎯 FIELD IDs (Based on your investigation)
const FIELD_IDS = {
    LINK: 10,
    FILENAME: 51,
    KEYWORDS_AI: 1,
    KEYWORDS_SUBJECT: 73,
    KEYWORDS_EVENT: 74,
    KEYWORDS_EMOTION: 75,
    KEYWORDS_RECOG: 84,
    KEYWORDS_LANDMARK: 85
};

const ALL_IDS = [10, 51, 1, 73, 74, 75, 84, 85];

async function patchMetadata() {
    console.log("🩹 Starting Metadata Patch (Regex Mode)...");

    const oldDb = await mysql.createConnection(oldDbConfig);
    console.log("✅ Connected to Old MySQL Database.");

    // 1. GET ALL MIGRATED ASSETS
    // We look for files that start with "migration/"
    const assetsToFix = await prisma.asset.findMany({
        where: {
            filename: { startsWith: 'migration/' }
        },
        select: { id: true, filename: true, originalName: true, aiData: true }
    });

    console.log(`Scanning ${assetsToFix.length} migrated assets...`);
    let successCount = 0;

    const placeholders = ALL_IDS.map(() => '?').join(',');

    for (const asset of assetsToFix) {
        // 🔍 EXTRACT ID FROM FILENAME
        // Format: "migration/634_123456.jpg" -> We want "634"
        const match = asset.filename.match(/migration\/(\d+)_/);
        const oldId = match ? match[1] : null;

        if (!oldId) {
            // console.log(`Skipping unknown format: ${asset.filename}`);
            continue;
        }

        try {
            // 2. QUERY NEW NODE TABLES
            const [rows]: any = await oldDb.execute(
                `SELECT n.resource_type_field, n.name AS value
                 FROM node n
                 JOIN resource_node rn ON n.ref = rn.node
                 WHERE rn.resource = ? 
                 AND n.resource_type_field IN (${placeholders})`,
                [oldId, ...ALL_IDS]
            );

            // If no metadata found, skip
            if (rows.length === 0) continue;

            let driveLink = null;
            let tags: string[] = [];

            for (const row of rows) {
                const fieldId = row.resource_type_field;
                const val = row.value;

                if (fieldId === FIELD_IDS.LINK) {
                    driveLink = val;
                } else if (fieldId !== FIELD_IDS.FILENAME) {
                    // Everything else is a tag
                    if (val) {
                        const cleanParts = val.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
                        tags.push(...cleanParts);
                    }
                }
            }

            // 3. Prepare Updates
            let aiDataObj: any = {};
            try { aiDataObj = JSON.parse(asset.aiData || '{}'); } catch (e) {}
            
            let dataChanged = false;

            if (driveLink && driveLink.trim()) {
                aiDataObj.externalLink = driveLink;
                dataChanged = true;
            }

            if (tags.length > 0) {
                const existingTags = aiDataObj.tags || [];
                const mergedTags = [...new Set([...existingTags, ...tags])];
                aiDataObj.tags = mergedTags;
                dataChanged = true;
            }

            if (dataChanged) {
                const updates = { aiData: JSON.stringify(aiDataObj) };
                await prisma.asset.update({ where: { id: asset.id }, data: updates });
                successCount++;
                process.stdout.write(`\r✅ Patched ID ${oldId}: Added ${tags.length} Tags ${driveLink ? '+ Link' : ''}`);
            }

        } catch (err: any) {
            console.error(`\n❌ Error processing ${oldId}: ${err.message}`);
        }
    }

    console.log(`\n\n✨ Patch Complete! Updated ${successCount} assets.`);
    await oldDb.end();
}

patchMetadata()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
