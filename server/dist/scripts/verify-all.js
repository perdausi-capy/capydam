"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="node" />
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkAll() {
    console.log("🕵️‍♂️ FINAL SYSTEM CHECK...");
    const users = await prisma.user.count({ where: { avatar: { contains: 'supabase.co' } } });
    const collections = await prisma.collection.count({ where: { coverImage: { contains: 'supabase.co' } } });
    const categories = await prisma.category.count({ where: { coverImage: { contains: 'supabase.co' } } });
    const feedback = await prisma.feedback.count({ where: { attachment: { contains: 'supabase.co' } } });
    const messages = await prisma.message.count({ where: { attachmentUrl: { contains: 'supabase.co' } } });
    // Check main assets again just in case
    const assets = await prisma.asset.count({ where: { path: { contains: 'supabase.co' } } });
    console.log(`\n🚨 REMAINING SUPABASE LINKS:`);
    console.log(`   - Assets (Main):      ${assets}`);
    console.log(`   - Users (Avatars):    ${users}`);
    console.log(`   - Collections:        ${collections}`);
    console.log(`   - Categories:         ${categories}`);
    console.log(`   - Feedback:           ${feedback}`);
    console.log(`   - Chat Messages:      ${messages}`);
    if (users + collections + categories + feedback + messages + assets === 0) {
        console.log(`\n🎉 CONGRATULATIONS! YOUR DATABASE IS 100% SUPABASE-FREE.`);
    }
    else {
        console.log(`\n⚠️ Some files remain. Run the migration scripts again.`);
    }
}
checkAll()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
