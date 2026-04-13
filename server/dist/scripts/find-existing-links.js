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
const findExistingLinks = async () => {
    console.log("🔍 Scanning library for assets WITH source links...");
    try {
        // Fetch all active assets
        const assets = await prisma.asset.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                originalName: true,
                createdAt: true,
                aiData: true,
                uploadedBy: { select: { name: true } }
            }
        });
        const foundLinksOutput = [];
        let count = 0;
        for (const asset of assets) {
            let extractedLinks = [];
            if (asset.aiData) {
                try {
                    const aiData = JSON.parse(asset.aiData);
                    // Check our new array format first
                    const linksArray = Array.isArray(aiData.links) ? aiData.links : [];
                    const validArrayLinks = linksArray.filter((l) => l && l.trim() !== '');
                    if (validArrayLinks.length > 0) {
                        extractedLinks.push(...validArrayLinks);
                    }
                    // Check legacy fields
                    else if (aiData.externalLink && aiData.externalLink.trim() !== '') {
                        extractedLinks.push(aiData.externalLink.trim());
                    }
                    else if (aiData.link && aiData.link.trim() !== '') {
                        extractedLinks.push(aiData.link.trim());
                    }
                    else if (aiData.url && aiData.url.trim() !== '') {
                        extractedLinks.push(aiData.url.trim());
                    }
                }
                catch (e) {
                    // JSON parse failed, ignore
                }
            }
            // If we found links, format them for the report
            if (extractedLinks.length > 0) {
                count++;
                const date = new Date(asset.createdAt).toISOString().split('T')[0];
                const uploader = asset.uploadedBy?.name || 'Unknown User';
                const name = asset.originalName || 'Untitled';
                const linksStr = extractedLinks.join(', ');
                foundLinksOutput.push(`[${date}] ${name} | Uploader: ${uploader} | ID: ${asset.id}\n   -> URL(s): ${linksStr}\n`);
            }
        }
        // Output file directly into your root folder
        const reportPath = path.resolve(__dirname, '../../found-source-links.txt');
        const header = `=================================================\n` +
            `   ASSETS WITH SOURCE LINKS (MIGRATION CHECK)\n` +
            `   Total Found: ${count}\n` +
            `   Generated: ${new Date().toLocaleString()}\n` +
            `=================================================\n\n`;
        fs.writeFileSync(reportPath, header + foundLinksOutput.join('\n'), 'utf-8');
        console.log(`✅ Scan complete! Found ${count} assets that successfully retained their source links.`);
        console.log(`📄 Report saved to your project root: found-source-links.txt`);
    }
    catch (error) {
        console.error("❌ Script failed:", error);
    }
    finally {
        await prisma.$disconnect();
    }
};
findExistingLinks();
