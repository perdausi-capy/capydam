import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const prisma = new PrismaClient();

// ⚠️ SAFETY SWITCH: Set to false to ACTUALLY write to the database
const DRY_RUN = false; 

// 🔧 CONFIGURATION
const KEYWORD_MAPPING: Record<string, string[]> = {
    "Tap and Reveal": ["tap", "reveal", "interactive", "card"],
    "Buttons": ["button", "clickable", "hover"],
    "Sliders": ["slider", "drag", "range"],
    "Quizzes": ["quiz", "question", "assessment", "score"],
    "Scenarios": ["scenario", "character", "dialogue"],
    // Add more...
};

async function main() {
    console.log(`\n🤖 Starting Asset Categorization (Explicit Relation Mode)...`);
    console.log(`🛡️  DRY RUN MODE: ${DRY_RUN ? "ON (No changes will be saved)" : "OFF (Database WILL be updated)"}\n`);

    // 1. Fetch all Categories
    const categories = await prisma.category.findMany();

    for (const category of categories) {
        // Determine search terms
        let searchTerms = KEYWORD_MAPPING[category.name];
        if (!searchTerms) {
            searchTerms = category.name.toLowerCase().split(' ').filter(w => w.length > 2);
        }

        if (searchTerms.length === 0) continue;

        // 2. Find assets that match keywords
        const matchingAssets = await prisma.asset.findMany({
            where: {
                // ✅ FIX 1: Correct filter for Explicit Relations
                // We check if the 'categories' list does NOT have an entry for this categoryId
                categories: {
                    none: {
                        categoryId: category.id 
                    }
                },
                OR: [
                    ...searchTerms.map(term => ({
                        aiData: { contains: term, mode: 'insensitive' as const }
                    })),
                    ...searchTerms.map(term => ({
                        originalName: { contains: term, mode: 'insensitive' as const }
                    }))
                ]
            },
            select: { id: true, originalName: true }
        });

        if (matchingAssets.length > 0) {
            console.log(`📂 Category: "${category.name}" (Keywords: ${searchTerms.join(', ')})`);
            console.log(`   found ${matchingAssets.length} NEW assets to add.`);

            if (!DRY_RUN) {
                // ✅ FIX 2: Create Join Table Records directly
                // Instead of updating the category, we bulk insert into the join table
                await prisma.assetOnCategory.createMany({
                    data: matchingAssets.map(asset => ({
                        assetId: asset.id,
                        categoryId: category.id
                    })),
                    skipDuplicates: true // Safety first!
                });
                
                console.log(`   ✅ Linked ${matchingAssets.length} assets successfully.`);
            } else {
                console.log(`   Preview: ${matchingAssets.slice(0, 3).map(a => a.originalName).join(', ')}...`);
            }
            console.log('-------------------------------------------');
        }
    }

    console.log("\n✨ Done!");
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
