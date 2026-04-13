"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="node" />
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const NEW_DOMAIN = 'storage.capy-dev.com';
async function verifyMigration() {
    console.log("🕵️‍♂️ Running Deep Verification...");
    const assets = await prisma.asset.findMany({
        where: { mimeType: { startsWith: 'video/' } },
        select: { id: true, previewFrames: true }
    });
    let valid = 0;
    let stillSupabase = 0;
    let empty = 0;
    let weird = 0;
    const samples = [];
    for (const asset of assets) {
        const frames = asset.previewFrames || [];
        if (frames.length === 0) {
            empty++;
            continue;
        }
        // Check the first frame to determine status
        const firstFrame = frames[0];
        if (firstFrame.includes(NEW_DOMAIN)) {
            valid++;
            // Save 5 random samples to show the user
            if (samples.length < 5)
                samples.push({ id: asset.id, url: firstFrame });
        }
        else if (firstFrame.includes('supabase.co')) {
            stillSupabase++;
        }
        else {
            weird++; // Neither Supabase nor Capy-Dev (Could be broken or relative path)
        }
    }
    console.log(`\n📊 FINAL STATS:`);
    console.log(`--------------------------------`);
    console.log(`✅ Migrated (Capy-Dev): ${valid}`);
    console.log(`❌ Pending (Supabase):  ${stillSupabase}`);
    console.log(`⚠️ Empty/No Previews:   ${empty}`);
    console.log(`❓ Unknown/Weird:       ${weird}`);
    console.log(`--------------------------------`);
    console.log(`TOTAL VIDEOS:           ${assets.length}`);
    console.log(`\n🔎 SAMPLING 5 RANDOM MIGRATED FILES:`);
    samples.forEach(s => {
        console.log(`   ID: ${s.id}`);
        console.log(`   URL: ${s.url}`); // Check this line carefully!
        console.log(`   ---`);
    });
}
verifyMigration()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
