import mysql from 'mysql2/promise';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import cliProgress from 'cli-progress';
import colors from 'colors';

// 1. Load Environment Variables (.env)
dotenv.config();

// --- ⚙️ CONFIGURATION ---
const RESOURCE_SPACE_PATH = '/var/www/html/resourcespace/filestore'; 
const BATCH_SIZE = 50; 

// --- 🔌 CLIENTS ---
const prisma = new PrismaClient();

// Ensure Supabase keys exist
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error(colors.red("❌ Missing SUPABASE_URL or SUPABASE_KEY in .env"));
    process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// MySQL Connection (Based on your config.php)
const mysqlConfig = {
  host: 'localhost',      
  user: 'resourcespace_rw',  // ✅ Updated from your config
  password: 'your_rw_password', // ⚠️ MAKE SURE THIS IS THE REAL PASSWORD
  database: 'resourcespace'
};

/**
 * 🕵️‍♂️ RESOURCE SPACE PATH FINDER
 * logic: ID 12345 -> Reversed "54321" -> Path "5/4/3/2/1_hash/original.jpg"
 */
function getRSFilePath(ref: number, extension: string): string | null {
  const refStr = ref.toString();
  // Reverse the ID (Standard ResourceSpace logic)
  const reversed = refStr.split('').reverse().join('');
  
  // A. Build the folder path digits (Everything except the last digit)
  // Example ID 12345 -> Reverse 54321 -> Path Parts ['5', '4', '3', '2']
  const pathParts = reversed.length > 1 ? reversed.slice(0, -1).split('') : [];
  const lastDigit = reversed.slice(-1);

  // B. Walk down the directory tree
  let currentPath = RESOURCE_SPACE_PATH;
  for (const part of pathParts) {
    currentPath = path.join(currentPath, part);
    if (!fs.existsSync(currentPath)) return null;
  }

  // C. Find the "Hashed" Folder (e.g., "1_a8f9...")
  try {
    const subdirs = fs.readdirSync(currentPath);
    // Find directory that starts with the last digit followed by underscore
    const hashedFolder = subdirs.find(d => d.startsWith(`${lastDigit}_`));

    if (!hashedFolder) return null;

    const fullFolderPath = path.join(currentPath, hashedFolder);

    // D. Find the Actual File
    const files = fs.readdirSync(fullFolderPath);
    const ext = extension.toLowerCase();
    
    // Priority search for the best quality original
    let targetFile = files.find(f => f.toLowerCase() === `original.${ext}`); // Best case
    
    if (!targetFile) {
        targetFile = files.find(f => f.toLowerCase() === `${ref}.${ext}`); // Fallback 1
    }
    
    // Fallback 2: Any file with correct extension that isn't a thumbnail
    if (!targetFile) {
        targetFile = files.find(f => 
            f.toLowerCase().endsWith(`.${ext}`) && 
            !f.includes('_scr') && 
            !f.includes('_thm') && 
            !f.includes('_col') && 
            !f.includes('_pre')
        );
    }

    return targetFile ? path.join(fullFolderPath, targetFile) : null;

  } catch (e) {
    return null;
  }
}

async function migrate() {
  console.log(colors.cyan('\n🚀 Starting Migration: ResourceSpace -> CapyDAM'));
  console.log(colors.gray(`   📂 Reading from: ${RESOURCE_SPACE_PATH}`));
  
  let db;
  try {
    db = await mysql.createConnection(mysqlConfig);
    console.log(colors.green(`   ✅ Connected to MySQL (resourcespace)`));
  } catch (e: any) {
    console.error(colors.red(`   ❌ MySQL Connection Failed: ${e.message}`));
    process.exit(1);
  }
  
  // 1. Count Resources
  const [countResult]: any = await db.execute('SELECT COUNT(*) as total FROM resource WHERE archive = 0');
  const totalResources = countResult[0].total;
  console.log(colors.cyan(`   📦 Total Active Resources: ${totalResources}\n`));

  const bar = new cliProgress.SingleBar({
    format: 'Migrating |' + colors.cyan('{bar}') + '| {percentage}% || {value}/{total} Files || ETA: {eta_formatted}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  bar.start(totalResources, 0);

  // 2. Get Default Admin User (Files need an owner)
  const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!adminUser) {
      bar.stop();
      console.error(colors.red("\n❌ ERROR: No Admin user found in Postgres. Register an account in CapyDAM first."));
      process.exit(1);
  }

  let offset = 0;
  let successCount = 0;
  let failCount = 0;

  while (offset < totalResources) {
    const [rows]: any = await db.execute(
      `SELECT ref, title, file_extension, creation_date, field8 as description 
       FROM resource 
       WHERE archive = 0 
       ORDER BY ref ASC
       LIMIT ${BATCH_SIZE} OFFSET ${offset}`
    );

    for (const res of rows) {
      try {
        // --- STEP 1: FIND FILE ON DISK ---
        if (!res.file_extension) { throw new Error("No file extension in DB"); }
        
        const localFilePath = getRSFilePath(res.ref, res.file_extension);
        
        if (!localFilePath) {
          throw new Error("File not found on disk");
        }

        // --- STEP 2: GET KEYWORDS ---
        // (Assuming standard RS keyword table structure)
        const [tagRows]: any = await db.execute(
          `SELECT k.keyword FROM resource_keyword rk 
           JOIN keyword k ON rk.keyword = k.ref 
           WHERE rk.resource = ?`, 
          [res.ref]
        );
        const tags = tagRows.map((t: any) => t.keyword);

        // --- STEP 3: UPLOAD TO SUPABASE ---
        const fileBuffer = fs.readFileSync(localFilePath);
        const uniquePath = `migration/${res.ref}_${Date.now()}.${res.file_extension}`;
        
        const { error: uploadError } = await supabase.storage
          .from('assets')
          .upload(uniquePath, fileBuffer, { 
              contentType: `image/${res.file_extension}`,
              upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage
          .from('assets')
          .getPublicUrl(uniquePath);

        // --- STEP 4: INSERT TO POSTGRES ---
        const stats = fs.statSync(localFilePath);
        
        await prisma.asset.create({
          data: {
            filename: uniquePath,
            originalName: res.title || `Resource ${res.ref}`,
            mimeType: `image/${res.file_extension}`, 
            size: stats.size,
            path: publicUrl.publicUrl,
            description: res.description || '',
            keywords: tags, 
            legacyId: res.ref,
            userId: adminUser.id,
            createdAt: res.creation_date ? new Date(res.creation_date) : new Date()
          }
        });

        successCount++;

      } catch (err: any) {
        failCount++;
        fs.appendFileSync('migration_errors.log', `[${new Date().toISOString()}] ID ${res.ref}: ${err.message}\n`);
      }
      
      bar.increment();
    }
    offset += BATCH_SIZE;
  }

  bar.stop();
  await db.end();
  await prisma.$disconnect();
  console.log(colors.rainbow('\n✨ Migration Complete!'));
  console.log(colors.green(`   ✅ Success: ${successCount}`));
  console.log(colors.red(`   ❌ Failed: ${failCount} (See migration_errors.log)`));
}

migrate().catch((e) => {
    console.error(colors.red("\n🔥 Fatal Error:"), e);
    process.exit(1);
});