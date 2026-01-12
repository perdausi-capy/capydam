"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyTrash = exports.forceDeleteAsset = exports.restoreAsset = exports.getTrash = void 0;
const client_1 = require("@prisma/client");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma = new client_1.PrismaClient();
// 1. GET /assets/trash - List deleted items
const getTrash = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 15;
        const skip = (page - 1) * limit;
        // Fetch items WHERE deletedAt is NOT null
        const [assets, total] = await Promise.all([
            prisma.asset.findMany({
                where: { NOT: { deletedAt: null } },
                orderBy: { deletedAt: 'desc' }, // Newest trash first
                skip,
                take: limit,
            }),
            prisma.asset.count({ where: { NOT: { deletedAt: null } } })
        ]);
        res.json({
            results: assets,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    }
    catch (error) {
        console.error("Get Trash Error:", error);
        res.status(500).json({ error: 'Failed to fetch trash' });
    }
};
exports.getTrash = getTrash;
// 2. POST /assets/:id/restore - Restore from Trash
const restoreAsset = async (req, res) => {
    try {
        const asset = await prisma.asset.update({
            where: { id: req.params.id },
            data: { deletedAt: null } // ♻️ Set deletedAt back to null
        });
        res.json({ message: 'Asset restored successfully', asset });
    }
    catch (error) {
        console.error("Restore Error:", error);
        res.status(500).json({ error: 'Failed to restore asset' });
    }
};
exports.restoreAsset = restoreAsset;
// 3. DELETE /assets/:id/force - Permanently Delete
const forceDeleteAsset = async (req, res) => {
    try {
        const asset = await prisma.asset.findUnique({ where: { id: req.params.id } });
        if (!asset)
            return res.status(404).json({ message: 'Asset not found' });
        // A. Delete physical file
        const filePath = path_1.default.join(process.cwd(), 'uploads', asset.filename);
        if (fs_1.default.existsSync(filePath)) {
            try {
                fs_1.default.unlinkSync(filePath);
            }
            catch (e) {
                console.error("File delete error:", e);
            }
        }
        // B. Delete thumbnail if exists
        if (asset.thumbnailPath) {
            const thumbPath = path_1.default.join(process.cwd(), 'uploads', asset.thumbnailPath);
            if (fs_1.default.existsSync(thumbPath)) {
                try {
                    fs_1.default.unlinkSync(thumbPath);
                }
                catch (e) {
                    console.error("Thumb delete error:", e);
                }
            }
        }
        // C. Delete DB record
        await prisma.asset.delete({ where: { id: req.params.id } });
        res.json({ message: 'Asset permanently deleted' });
    }
    catch (error) {
        console.error("Force Delete Error:", error);
        res.status(500).json({ error: 'Failed to delete asset permanently' });
    }
};
exports.forceDeleteAsset = forceDeleteAsset;
// 4. DELETE /assets/trash/empty - Empty Trash
const emptyTrash = async (req, res) => {
    try {
        const assets = await prisma.asset.findMany({ where: { NOT: { deletedAt: null } } });
        // Delete all files
        assets.forEach(asset => {
            const filePath = path_1.default.join(process.cwd(), 'uploads', asset.filename);
            if (fs_1.default.existsSync(filePath))
                try {
                    fs_1.default.unlinkSync(filePath);
                }
                catch { }
            if (asset.thumbnailPath) {
                const thumbPath = path_1.default.join(process.cwd(), 'uploads', asset.thumbnailPath);
                if (fs_1.default.existsSync(thumbPath))
                    try {
                        fs_1.default.unlinkSync(thumbPath);
                    }
                    catch { }
            }
        });
        // Clear DB
        await prisma.asset.deleteMany({ where: { NOT: { deletedAt: null } } });
        res.json({ message: 'Trash emptied' });
    }
    catch (error) {
        console.error("Empty Trash Error:", error);
        res.status(500).json({ error: 'Failed to empty trash' });
    }
};
exports.emptyTrash = emptyTrash;
