"use strict";
/// <reference types="node" />
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const lib_storage_1 = require("@aws-sdk/lib-storage");
const storage_1 = require("../lib/storage");
const prisma = new client_1.PrismaClient();
// Helper function to handle the move
async function moveFile(oldUrl, folderName) {
    if (!oldUrl || !oldUrl.includes('supabase.co'))
        return null;
    try {
        console.log(`   -> Moving: ${oldUrl}`);
        const response = await (0, axios_1.default)({ method: 'get', url: oldUrl, responseType: 'stream' });
        // Try to keep original folder structure or default to provided folder
        let key = oldUrl.split('/assets/')[1];
        if (!key)
            key = `${folderName}/${oldUrl.split('/').pop()}`;
        key = decodeURIComponent(key);
        const upload = new lib_storage_1.Upload({
            client: storage_1.storageClient,
            params: {
                Bucket: storage_1.BUCKET_NAME,
                Key: key,
                Body: response.data,
                ContentType: response.headers['content-type'],
            },
        });
        await upload.done();
        return `${storage_1.PUBLIC_URL_BASE}/${key}`;
    }
    catch (e) {
        console.error(`   ❌ Failed: ${oldUrl}`);
        return null;
    }
}
async function migrateExtras() {
    console.log("🚀 Starting CLEANUP Migration (Avatars, Covers, Chat)...");
    // --- 1. USERS (Avatars) ---
    const users = await prisma.user.findMany({ where: { avatar: { contains: 'supabase' } } });
    console.log(`\nFound ${users.length} User Avatars.`);
    for (const u of users) {
        const newUrl = await moveFile(u.avatar, 'avatars');
        if (newUrl)
            await prisma.user.update({ where: { id: u.id }, data: { avatar: newUrl } });
    }
    // --- 2. COLLECTIONS (Cover Images) ---
    const collections = await prisma.collection.findMany({ where: { coverImage: { contains: 'supabase' } } });
    console.log(`\nFound ${collections.length} Collection Covers.`);
    for (const c of collections) {
        const newUrl = await moveFile(c.coverImage, 'covers');
        if (newUrl)
            await prisma.collection.update({ where: { id: c.id }, data: { coverImage: newUrl } });
    }
    // --- 3. CATEGORIES (Cover Images) ---
    const categories = await prisma.category.findMany({ where: { coverImage: { contains: 'supabase' } } });
    console.log(`\nFound ${categories.length} Category Covers.`);
    for (const c of categories) {
        const newUrl = await moveFile(c.coverImage, 'covers');
        if (newUrl)
            await prisma.category.update({ where: { id: c.id }, data: { coverImage: newUrl } });
    }
    // --- 4. FEEDBACK (Attachments) ---
    const feedbacks = await prisma.feedback.findMany({ where: { attachment: { contains: 'supabase' } } });
    console.log(`\nFound ${feedbacks.length} Feedback Attachments.`);
    for (const f of feedbacks) {
        const newUrl = await moveFile(f.attachment, 'feedback');
        if (newUrl)
            await prisma.feedback.update({ where: { id: f.id }, data: { attachment: newUrl } });
    }
    // --- 5. MESSAGES (Chat Files) ---
    const messages = await prisma.message.findMany({ where: { attachmentUrl: { contains: 'supabase' } } });
    console.log(`\nFound ${messages.length} Chat Attachments.`);
    for (const m of messages) {
        const newUrl = await moveFile(m.attachmentUrl, 'chat');
        if (newUrl)
            await prisma.message.update({ where: { id: m.id }, data: { attachmentUrl: newUrl } });
    }
    console.log("\n✅ All Extras Migrated!");
}
migrateExtras()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
