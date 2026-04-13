/// <reference types="node" />
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url'; // <--- ADD THIS

// --- FIX FOR ES MODULES ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --------------------------

// 1. CONFIGURATION
const ROOT_DIR = path.resolve(__dirname, '..'); 
const OUTPUT_FILE = path.join(ROOT_DIR, 'full_frontend_context.txt');
// Folders to IGNORE (Noise)
const IGNORE_DIRS = [
  'node_modules', 
  '.git', 
  'dist', 
  'build',
  '.next',
  'coverage', 
  'public', // Usually just assets, skip unless you have code here
  '.vscode'
];

// Files to IGNORE
const IGNORE_FILES = [
  'package-lock.json', 
  'yarn.lock',
  '.env',
  '.env.local',
  'README.md',
  'full_frontend_context.txt' // Don't read the output file itself!
];

// Extensions we want to read
const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.json', '.html'];

function shouldIgnore(entryName: string, isDirectory: boolean): boolean {
  if (isDirectory) {
    return IGNORE_DIRS.includes(entryName);
  }
  // Ignore specific files
  if (IGNORE_FILES.includes(entryName)) return true;
  
  // Ignore images/media explicitly just in case
  if (entryName.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) return true;

  return false;
}

function scanDirectory(dir: string, fileList: string[] = []) {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (shouldIgnore(entry, stat.isDirectory())) continue;

    if (stat.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else {
      const ext = path.extname(entry);
      if (INCLUDE_EXTENSIONS.includes(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function generateContext() {
  console.log(`🚀 Scanning FRONTEND codebase at: ${ROOT_DIR}...`);
  
  const files = scanDirectory(ROOT_DIR);
  let content = `FRONTEND CODEBASE CONTEXT\nGenerated on: ${new Date().toISOString()}\n\n`;

  // 1. Add Directory Structure (Tree) first
  content += `=== FILE STRUCTURE ===\n`;
  files.forEach(f => content += `- ${path.relative(ROOT_DIR, f)}\n`);
  content += `\n======================\n\n`;

  // 2. Add File Contents
  let fileCount = 0;
  for (const file of files) {
    try {
      const fileContent = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(ROOT_DIR, file);
      
      content += `\n\n================================================\n`;
      content += `FILE: ${relPath}\n`;
      content += `================================================\n`;
      content += fileContent;
      
      fileCount++;
      process.stdout.write('.'); // Progress dot
    } catch (e) {
      console.error(`\n❌ Error reading ${file}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, content);
  console.log(`\n\n✅ Done! Read ${fileCount} files.`);
  console.log(`📄 Output saved to: ${OUTPUT_FILE}`);
}

generateContext();
