"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
const findMissingLinks = async () => {
    console.log("🔍 Scanning library for assets without source links...");
    try {
        // Fetch all active assets (ignoring those in the trash)
        const assets = await prisma.asset.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                originalName: true,
                createdAt: true,
                aiData: true,
                uploadedBy: { select: { name: true } } // Grab the uploader if it exists
            }
        });
        const missingLinks = [];
        let count = 0;
        for (const asset of assets) {
            let hasLink = false;
            if (asset.aiData) {
                try {
                    const aiData = JSON.parse(asset.aiData);
                    // Check our new array format
                    const linksArray = Array.isArray(aiData.links) ? aiData.links : [];
                    const validArrayLinks = linksArray.filter((l) => l && l.trim() !== '');
                    // Check legacy fields just in case
                    if (validArrayLinks.length > 0 ||
                        (aiData.externalLink && aiData.externalLink.trim() !== '') ||
                        (aiData.link && aiData.link.trim() !== '') ||
                        (aiData.url && aiData.url.trim() !== '')) {
                        hasLink = true;
                    }
                }
                catch (e) {
                    // If JSON fails to parse, it means there is no valid link data
                    hasLink = false;
                }
            }
            // If no link was found, format a clean line for the text file
            if (!hasLink) {
                count++;
                const date = new Date(asset.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
                const uploader = asset.uploadedBy?.name || 'Unknown User';
                const name = asset.originalName || 'Untitled';
                missingLinks.push(`[${date}] ${name} | Uploader: ${uploader} | ID: ${asset.id}`);
            }
        }
        // Output file directly into your root folder
        const reportPath = path.resolve(__dirname, '../../missing-source-links.txt');
        const header = `=================================================\n` +
            `   ASSETS MISSING SOURCE LINKS REPORT\n` +
            `   Total Missing: ${count}\n` +
            `   Generated: ${new Date().toLocaleString()}\n` +
            `=================================================\n\n`;
        fs.writeFileSync(reportPath, header + missingLinks.join('\n'), 'utf-8');
        console.log(`✅ Scan complete! Found ${count} assets missing source links.`);
        console.log(`📄 Report saved to your project root: missing-source-links.txt`);
    }
    catch (error) {
        console.error("❌ Script failed:", error);
    }
    finally {
        await prisma.$disconnect();
    }
};
findMissingLinks();
