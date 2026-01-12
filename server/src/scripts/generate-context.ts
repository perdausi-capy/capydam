/// <reference types="node" />
import fs from 'fs';
import path from 'path';

// 1. CONFIGURATION
const ROOT_DIR = path.resolve(__dirname, '../..'); // Points to 'server/'
const OUTPUT_FILE = path.join(ROOT_DIR, 'full_codebase_context.txt');

// Folders/Files to IGNORE (Noise)
const IGNORE_PATTERNS = [
  'node_modules', 
  '.git', 
  'dist', 
  'coverage', 
  'package-lock.json', 
  'yarn.lock',
  '.env',
  'migration_errors.log',
  'uploads',
  'README.md'
];

// File extensions we actually care about
const INCLUDE_EXTENSIONS = ['.ts', '.js', '.prisma', '.json', '.sql'];

function shouldIgnore(entryName: string): boolean {
  return IGNORE_PATTERNS.some(pattern => entryName.includes(pattern));
}

function scanDirectory(dir: string, fileList: string[] = []) {
  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const relPath = path.relative(ROOT_DIR, fullPath);

    if (shouldIgnore(entry)) continue;

    const stat = fs.statSync(fullPath);

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
  console.log(`🚀 Scanning codebase at: ${ROOT_DIR}...`);
  
  const files = scanDirectory(ROOT_DIR);
  let content = `PROJECT CODEBASE CONTEXT\nGenerated on: ${new Date().toISOString()}\n\n`;

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
