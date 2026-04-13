"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
const prisma = new client_1.PrismaClient();
const CREDENTIALS_PATH = path_1.default.join(__dirname, 'credentials.json');
const TOKEN_PATH = path_1.default.join(__dirname, 'token.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
// ⚠️ SAFETY SWITCH: Set to false to ACTUALLY write the links to your database
const DRY_RUN = true;
// ✅ TARGET SPECIFIC DRIVE ID
const SHARED_DRIVE_ID = '0AEuEbTKgQ6EgUk9PVA';
// --- SUPER-FUZZY NORMALIZER ---
// Removes extensions, spaces, symbols, and makes everything lowercase
function cleanString(str) {
    if (!str)
        return '';
    let base = str.replace(/\.(mp4|m4v|mov|avi|jpg|jpeg|png|gif|svg|pdf)$/gi, '');
    return base.toLowerCase().replace(/[^a-z0-9]/g, '');
}
// --- OAUTH 2.0 AUTHENTICATION FUNCTION ---
async function authorize() {
    if (!fs_1.default.existsSync(CREDENTIALS_PATH)) {
        console.error(`❌ ERROR: Could not find ${CREDENTIALS_PATH}`);
        process.exit(1);
    }
    const content = fs_1.default.readFileSync(CREDENTIALS_PATH, 'utf8');
    const credentials = JSON.parse(content);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const redirectUri = (redirect_uris && redirect_uris.length > 0) ? redirect_uris[0] : 'http://localhost';
    const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirectUri);
    if (fs_1.default.existsSync(TOKEN_PATH)) {
        const token = fs_1.default.readFileSync(TOKEN_PATH, 'utf8');
        oAuth2Client.setCredentials(JSON.parse(token));
        return oAuth2Client;
    }
    return await getNewToken(oAuth2Client);
}
function getNewToken(oAuth2Client) {
    return new Promise((resolve, reject) => {
        const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
        console.log('\n🔐 AUTHORIZATION REQUIRED');
        console.log('1. Click this link:\n', authUrl);
        const rl = readline_1.default.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('2. Paste the authorization code here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err)
                    return reject(new Error('Error retrieving access token: ' + err.message));
                if (token) {
                    oAuth2Client.setCredentials(token);
                    fs_1.default.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                }
                resolve(oAuth2Client);
            });
        });
    });
}
// --- MAIN MIGRATION FUNCTION ---
async function runAutoMatch() {
    console.log(`\n🚀 Starting Super-Fuzzy Google Drive Auto-Match...`);
    console.log(`🛡️  DRY RUN MODE: ${DRY_RUN ? "ON (No database changes)" : "OFF (Writing to Database)"}\n`);
    const authClient = await authorize();
    const drive = googleapis_1.google.drive({ version: 'v3', auth: authClient });
    try {
        console.log(`✅ Authenticated with Google Drive.`);
        console.log(`⏳ Fetching ALL files from the Shared Drive. Please wait...`);
        // 1. Build Local Cache of the Shared Drive
        let allDriveFiles = [];
        let pageToken = undefined;
        do {
            const res = await drive.files.list({
                corpora: 'drive',
                driveId: SHARED_DRIVE_ID,
                includeItemsFromAllDrives: true,
                supportsAllDrives: true,
                q: "trashed=false",
                fields: "nextPageToken, files(id, name, webViewLink)",
                pageToken: pageToken,
                pageSize: 1000
            });
            if (res.data.files) {
                allDriveFiles = allDriveFiles.concat(res.data.files);
                process.stdout.write(`\r   -> Cached ${allDriveFiles.length} files...`);
            }
            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);
        console.log(`\n📦 Successfully cached ${allDriveFiles.length} files into memory.\n`);
        // 2. Map the Drive files using the fuzzy string
        const driveFileMap = new Map();
        for (const file of allDriveFiles) {
            const cleanName = cleanString(file.name);
            if (!driveFileMap.has(cleanName)) {
                driveFileMap.set(cleanName, []);
            }
            driveFileMap.get(cleanName).push(file);
        }
        // 3. Fetch assets missing links from DB
        const allAssets = await prisma.asset.findMany({ select: { id: true, originalName: true, aiData: true } });
        const targetAssets = allAssets.filter(asset => {
            if (!asset.aiData)
                return true;
            try {
                const ai = JSON.parse(asset.aiData);
                if (!ai.externalLink && (!ai.links || ai.links.length === 0))
                    return true;
            }
            catch (e) {
                return true;
            }
            return false;
        });
        console.log(`📂 Found ${targetAssets.length} assets in database missing links.\n`);
        let successCount = 0;
        let missingCount = 0;
        let multipleCount = 0;
        // 4. Perform the Fuzzy Match
        for (const [index, asset] of targetAssets.entries()) {
            const cleanAsset = cleanString(asset.originalName);
            const matches = driveFileMap.get(cleanAsset) || [];
            process.stdout.write(`[${index + 1}/${targetAssets.length}] "${asset.originalName}" -> `);
            if (matches.length === 0) {
                console.log(`❌ Not found`);
                missingCount++;
            }
            else {
                if (matches.length > 1) {
                    console.log(`⚠️ Found ${matches.length} duplicates! Linked to: "${matches[0].name}"`);
                    multipleCount++;
                }
                else {
                    console.log(`✅ MATCH! Linked to: "${matches[0].name}"`);
                }
                const driveLink = matches[0].webViewLink;
                // 5. Update Database (if not DRY RUN)
                if (!DRY_RUN && driveLink) {
                    let aiDataObj = {};
                    try {
                        aiDataObj = JSON.parse(asset.aiData || '{}');
                    }
                    catch (e) { }
                    aiDataObj.externalLink = driveLink;
                    aiDataObj.links = [driveLink];
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { aiData: JSON.stringify(aiDataObj) }
                    });
                }
                successCount++;
            }
        }
        console.log(`\n=========================================`);
        console.log(`🎯 MISSION COMPLETE`);
        console.log(`✅ Successfully Matched: ${successCount}`);
        if (multipleCount > 0)
            console.log(`⚠️ Duplicate Names Found: ${multipleCount}`);
        console.log(`❌ Not Found in Drive: ${missingCount}`);
        console.log(`=========================================\n`);
        if (DRY_RUN) {
            console.log(`ℹ️ NOTE: This was a DRY RUN. Change 'const DRY_RUN = false;' to save to the database.`);
        }
    }
    catch (error) {
        console.error('\n🔥 Fatal Error:', error.message || error);
    }
}
runAutoMatch().finally(async () => { await prisma.$disconnect(); });
