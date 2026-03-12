const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const sourceOutputFile = path.join(rootDir, 'capydam_full_source_code.txt');
const docsOutputFile = path.join(rootDir, 'capydam_documentation.txt');

const excludeDirs = ['node_modules', 'dist', 'build', '.git', '.next', 'uploads', 'postgres-data', 'minio-data'];
const docExts = ['.md'];
const sourceExts = ['.ts', '.tsx', '.js', '.jsx', '.css', '.prisma', '.json', '.env.example', '.env'];

function walkSync(currentDirPath, callback) {
    let items;
    try {
        items = fs.readdirSync(currentDirPath);
    } catch (e) {
        return;
    }

    items.forEach(function (name) {
        const filePath = path.join(currentDirPath, name);
        try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                callback(filePath, stat);
            } else if (stat.isDirectory()) {
                if (!excludeDirs.includes(name)) {
                    walkSync(filePath, callback);
                }
            }
        } catch (e) {
            // ignore
        }
    });
}

let sourceContent = '# CapyDam Full Source Code Context\n\n';
let docContent = '# CapyDam Documentation Context\n\n';

console.log('Gathering files...');
walkSync(rootDir, (filePath) => {
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);

    // Skip self and lockfiles
    if (filePath === sourceOutputFile || filePath === docsOutputFile || fileName === 'package-lock.json' || fileName === 'bundle_source.js') {
        return;
    }

    const relPath = path.relative(rootDir, filePath);

    try {
        const stat = fs.statSync(filePath);
        if (stat.size > 1024 * 1024) { // 1MB limit per file
            console.log(`Skipping large file: ${relPath}`);
            return;
        }

        const fileHeader = `\n\n============================================================\nFILE: ${relPath}\n============================================================\n\n`;
        const content = fs.readFileSync(filePath, 'utf8');

        if (docExts.includes(ext)) {
            console.log(`Adding documentation: ${relPath}`);
            docContent += fileHeader + content;
        } else if (sourceExts.includes(ext)) {
            console.log(`Adding source code: ${relPath}`);
            sourceContent += fileHeader + content;
        }
    } catch (err) {
        console.log(`Error processing file: ${relPath} - ${err.message}`);
    }
});

try {
    fs.writeFileSync(sourceOutputFile, sourceContent);
    fs.writeFileSync(docsOutputFile, docContent);

    console.log(`\nSuccessfully created ${sourceOutputFile}`);
    console.log(`Total source size: ${(fs.statSync(sourceOutputFile).size / (1024 * 1024)).toFixed(2)} MB`);

    console.log(`\nSuccessfully created ${docsOutputFile}`);
    console.log(`Total docs size: ${(fs.statSync(docsOutputFile).size / 1024).toFixed(2)} KB`);
} catch (e) {
    console.error('Failed to write output files:', e);
}
