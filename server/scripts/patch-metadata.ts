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

// 🎯 ALL FIELD IDs
const FIELD_IDS = {
    LINK: 10,
    FILENAME: 51,
    
    // Description Candidates
    TITLE: 8,           // 👈 NEW! Found this in your spy data
    DESC_CAPTION: 18,
    DESC_EXTENDED: 87,
    DESC_NOTES: 25,

    // Tags
    KEYWORDS_AI: 1,
    KEYWORDS_SUBJECT: 73,
    KEYWORDS_EVENT: 74,
    KEYWORDS_EMOTION: 75,
    KEYWORDS_RECOG: 84,
    KEYWORDS_LANDMARK: 85
};

const ALL_IDS = Object.values(FIELD_IDS);

async function patchMetadata() {
    console.log("🩹 Starting Final Patch (Including Titles as Descriptions)...");

    const oldDb = await mysql.createConnection(oldDbConfig);
    console.log("✅ Connected to Old MySQL Database.");

    const assetsToFix = await prisma.asset.findMany({
        where: { filename: { startsWith: 'migration/' } },
        select: { id: true, filename: true, originalName: true, aiData: true }
    });

    console.log(`Scanning ${assetsToFix.length} migrated assets...`);
    let successCount = 0;

    const placeholders = ALL_IDS.map(() => '?').join(',');

    for (const asset of assetsToFix) {
        const match = asset.filename.match(/migration\/(\d+)_/);
        const oldId = match ? match[1] : null;

        if (!oldId) continue;

        try {
            const [rows]: any = await oldDb.execute(
                `SELECT n.resource_type_field, n.name AS value
                 FROM node n
                 JOIN resource_node rn ON n.ref = rn.node
                 WHERE rn.resource = ? 
                 AND n.resource_type_field IN (${placeholders})`,
                [oldId, ...ALL_IDS]
            );

            if (rows.length === 0) continue;

            let driveLink = null;
            let tags: string[] = [];
            
            // Description Candidates
            let valTitle = null;
            let valCaption = null;
            let valExtended = null;
            let valNotes = null;

            for (const row of rows) {
                const fieldId = row.resource_type_field;
                const val = row.value;

                if (fieldId === FIELD_IDS.LINK) driveLink = val;
                else if (fieldId === FIELD_IDS.TITLE) valTitle = val;
                else if (fieldId === FIELD_IDS.DESC_CAPTION) valCaption = val;
                else if (fieldId === FIELD_IDS.DESC_EXTENDED) valExtended = val;
                else if (fieldId === FIELD_IDS.DESC_NOTES) valNotes = val;
                else if (fieldId !== FIELD_IDS.FILENAME) {
                    if (val) {
                        const cleanParts = val.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
                        tags.push(...cleanParts);
                    }
                }
            }

            // Prepare Updates
            let aiDataObj: any = {};
            try { aiDataObj = JSON.parse(asset.aiData || '{}'); } catch (e) {}
            
            let dataChanged = false;

            if (driveLink && driveLink.trim()) {
                aiDataObj.externalLink = driveLink;
                dataChanged = true;
            }

            // Waterfall: Caption -> Title -> Extended -> Notes
            // We prioritized Title because we saw it has good data!
            const bestDescription = valCaption || valTitle || valExtended || valNotes;
            
            if (bestDescription && bestDescription.trim()) {
                // Remove quotes if present (e.g. '"Title"')
                const cleanDesc = bestDescription.trim().replace(/^"|"$/g, '');
                aiDataObj.description = cleanDesc;
                aiDataObj.summary = cleanDesc;
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
                process.stdout.write(`\r✅ Patched ID ${oldId}: +Desc? ${!!bestDescription} [${tags.length} Tags]`);
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
