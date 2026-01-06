// server/src/scripts/reset.ts
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from the server/.env file
dotenv.config();

const prisma = new PrismaClient();

// Use Service Role Key if available (bypasses RLS), otherwise fallback to standard key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ⚠️ CHANGE THIS if your bucket is named differently in Supabase
const BUCKET_NAME = 'chat-attachments'; 

async function main() {
  console.log('🚨 STARTING NUCLEAR RESET 🚨');

  // --- 1. CLEAR DATABASE ---
  console.log('\n🗑️  Cleaning Database...');
  
  try {
    // Delete in specific order to handle Foreign Keys
    await prisma.notification.deleteMany({});
    console.log(' - Deleted Notifications');

    await prisma.reaction.deleteMany({});
    console.log(' - Deleted Reactions');

    await prisma.message.deleteMany({});
    console.log(' - Deleted Messages');

    await prisma.membership.deleteMany({});
    console.log(' - Deleted Memberships');

    await prisma.chatRoom.deleteMany({});
    console.log(' - Deleted Chat Rooms');
    
    // Optional: Delete users if you want a complete wipe (Commented out for safety)
    // await prisma.user.deleteMany({}); 
    // console.log(' - Deleted Users');

  } catch (error) {
    console.error("❌ Database cleanup failed:", error);
  }

  // --- 2. CLEAR STORAGE ---
  console.log('\n🗑️  Cleaning Supabase Storage...');
  
  try {
    // List files (Supabase lists max 100 at a time, loop might be needed for massive buckets, but this clears the bulk)
    const { data: files, error: listError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .list(undefined, { limit: 100 });

    if (listError) {
      console.error('❌ Error listing files (Check BUCKET_NAME):', listError.message);
    } else if (files && files.length > 0) {
      const pathsToRemove = files.map((file) => file.name);
      
      const { error: removeError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove(pathsToRemove);

      if (removeError) {
        console.error('❌ Error deleting files:', removeError.message);
      } else {
        console.log(`✅ Deleted ${files.length} files from storage.`);
        console.log(`ℹ️  (If you have >100 files, run this script again)`);
      }
    } else {
      console.log(' - Storage bucket is already empty.');
    }
  } catch (error) {
    console.error("❌ Storage cleanup failed:", error);
  }

  console.log('\n✅ RESET COMPLETE.');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });