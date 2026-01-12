"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Run this with: npx ts-node src/scripts/reset.ts
const client_1 = require("@prisma/client");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
// Initialize Supabase Admin Client (Needs Service Role Key for deletion)
// If you don't have SERVICE_ROLE_KEY in .env, use your SUPABASE_KEY temporarily
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY);
const BUCKET_NAME = 'chat-attachments'; // Change this to your actual bucket name
async function main() {
    console.log('🚨 STARTING NUCLEAR RESET 🚨');
    // --- 1. CLEAR DATABASE ---
    console.log('\n🗑️  Cleaning Database...');
    // Delete in order to avoid foreign key constraint errors
    await prisma.notification.deleteMany({});
    console.log(' - Deleted Notifications');
    await prisma.reaction.deleteMany({});
    console.log(' - Deleted Reactions');
    await prisma.message.deleteMany({});
    console.log(' - Deleted Messages');
    await prisma.membership.deleteMany({});
    console.log(' - Deleted Memberships');
    // Delete all rooms EXCEPT specific ones if you want to keep them (optional)
    // For now, we delete ALL rooms.
    await prisma.chatRoom.deleteMany({});
    console.log(' - Deleted Chat Rooms');
    // --- 2. CLEAR STORAGE ---
    console.log('\n🗑️  Cleaning Supabase Storage...');
    try {
        // List all files in the bucket
        const { data: files, error: listError } = await supabase
            .storage
            .from(BUCKET_NAME)
            .list(undefined, { limit: 1000 });
        if (listError) {
            console.error('Error listing files:', listError.message);
        }
        else if (files && files.length > 0) {
            const pathsToRemove = files.map((file) => file.name);
            const { error: removeError } = await supabase
                .storage
                .from(BUCKET_NAME)
                .remove(pathsToRemove);
            if (removeError) {
                console.error('Error deleting files:', removeError.message);
            }
            else {
                console.log(` - Deleted ${files.length} files from storage`);
            }
        }
        else {
            console.log(' - Storage bucket is already empty');
        }
    }
    catch (error) {
        console.error("Storage cleanup failed (Check your Bucket Name):", error);
    }
    console.log('\n✅ RESET COMPLETE. Your app is fresh.');
}
main()
    .catch((e) => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
