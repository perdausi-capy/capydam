"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="node" />
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// 1. CONFIGURATION
const ROOT_DIR = path_1.default.resolve(__dirname, '../..'); // Points to 'server/'
const OUTPUT_FILE = path_1.default.join(ROOT_DIR, 'full_codebase_context.txt');
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
function shouldIgnore(entryName) {
    return IGNORE_PATTERNS.some(pattern => entryName.includes(pattern));
}
function scanDirectory(dir, fileList = []) {
    const entries = fs_1.default.readdirSync(dir);
    for (const entry of entries) {
        const fullPath = path_1.default.join(dir, entry);
        const relPath = path_1.default.relative(ROOT_DIR, fullPath);
        if (shouldIgnore(entry))
            continue;
        const stat = fs_1.default.statSync(fullPath);
        if (stat.isDirectory()) {
            scanDirectory(fullPath, fileList);
        }
        else {
            const ext = path_1.default.extname(entry);
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
    files.forEach(f => content += `- ${path_1.default.relative(ROOT_DIR, f)}\n`);
    content += `\n======================\n\n`;
    // 2. Add File Contents
    let fileCount = 0;
    for (const file of files) {
        try {
            const fileContent = fs_1.default.readFileSync(file, 'utf-8');
            const relPath = path_1.default.relative(ROOT_DIR, file);
            content += `\n\n================================================\n`;
            content += `FILE: ${relPath}\n`;
            content += `================================================\n`;
            content += fileContent;
            fileCount++;
            process.stdout.write('.'); // Progress dot
        }
        catch (e) {
            console.error(`\n❌ Error reading ${file}`);
        }
    }
    fs_1.default.writeFileSync(OUTPUT_FILE, content);
    console.log(`\n\n✅ Done! Read ${fileCount} files.`);
    console.log(`📄 Output saved to: ${OUTPUT_FILE}`);
}
generateContext();
