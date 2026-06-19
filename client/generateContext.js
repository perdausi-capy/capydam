import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = __dirname;
const OUTPUT_FILE = path.join(ROOT_DIR, 'client_codebase_context.txt');

const IGNORE_PATTERNS = [
  'node_modules', 
  '.git', 
  'dist', 
  'build',
  'package-lock.json', 
  'yarn.lock',
  '.env',
  'public',
  'client_codebase_context.txt' 
];

const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css'];

function shouldIgnore(entryName) {
  return IGNORE_PATTERNS.some(pattern => entryName.includes(pattern));
}

function scanDirectory(dir, fileList = []) {
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
  console.log(`🚀 Scanning frontend codebase at: ${ROOT_DIR}...`);
  
  const files = scanDirectory(ROOT_DIR);
  let content = `CLIENT CODEBASE CONTEXT\nGenerated on: ${new Date().toISOString()}\n\n`;

  content += `=== FILE STRUCTURE ===\n`;
  files.forEach(f => content += `- ${path.relative(ROOT_DIR, f)}\n`);
  content += `\n======================\n\n`;

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
      process.stdout.write('.');
    } catch (e) {
      console.error(`\n❌ Error reading ${file}`);
    }
  }

  fs.writeFileSync(OUTPUT_FILE, content);
  console.log(`\n\n✅ Done! Read ${fileCount} files.`);
}

generateContext();