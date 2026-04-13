import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const CSV_PATH = path.join(__dirname, '../../missing-links-handoff.csv');
const BASE_URL = 'https://dam.capy-dev.com/assets';

async function exportCSV() {
    console.log("📊 Generating spreadsheet with Direct DAM Links...");

    const assets = await prisma.asset.findMany();
    
    // Updated headers to include the Direct Link
    let csvContent = "Asset ID,Filename,Upload Date,Direct DAM Link,Google Drive Link (To Be Filled)\n";
    let missingCount = 0;

    for (const asset of assets) {
        let aiDataObj = asset.aiData ? JSON.parse(asset.aiData) : {};
        
        // Only include assets missing the external link
        if (!aiDataObj.externalLink) {
            missingCount++;
            
            const uploadDate = asset.createdAt ? new Date(asset.createdAt).toISOString().split('T')[0] : 'Unknown';
            const safeFilename = `"${asset.originalName.replace(/"/g, '""')}"`;
            
            // Generate the direct, clickable link to the asset page
            const damLink = `${BASE_URL}/${asset.id}`;
            
            // Build the row
            csvContent += `${asset.id},${safeFilename},${uploadDate},${damLink},\n`;
        }
    }

    fs.writeFileSync(CSV_PATH, csvContent);
    console.log(`\n✅ Success! Saved ${missingCount} assets to spreadsheet.`);
    console.log(`📁 File location: ${CSV_PATH}`);
}

exportCSV().finally(() => prisma.$disconnect());
