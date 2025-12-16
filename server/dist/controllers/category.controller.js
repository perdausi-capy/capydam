"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategory = exports.deleteCategory = exports.createCategory = exports.removeAssetFromCategory = exports.addAssetToCategory = exports.getCategoryById = exports.getCategories = void 0;
const prisma_1 = require("../lib/prisma");
// Get All Categories (Grouped)
const getCategories = async (req, res) => {
    try {
        const categories = await prisma_1.prisma.category.findMany({
            include: { _count: { select: { assets: true } } },
            orderBy: { name: 'asc' }
        });
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};
exports.getCategories = getCategories;
// Get Single Category with Assets
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await prisma_1.prisma.category.findUnique({
            where: { id },
            include: {
                assets: {
                    include: {
                        asset: { include: { uploadedBy: { select: { name: true } } } }
                    }
                }
            }
        });
        if (!category) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        // Flatten structure
        const flatCategory = { ...category, assets: category.assets.map(a => a.asset) };
        res.json(flatCategory);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
exports.getCategoryById = getCategoryById;
// Add Asset to Category
const addAssetToCategory = async (req, res) => {
    try {
        const { id } = req.params; // Category ID
        const { assetId } = req.body;
        await prisma_1.prisma.assetOnCategory.create({ data: { categoryId: id, assetId } });
        res.json({ success: true });
    }
    catch (error) {
        res.json({ success: true });
    } // Ignore duplicates
};
exports.addAssetToCategory = addAssetToCategory;
// Remove Asset from Category
const removeAssetFromCategory = async (req, res) => {
    try {
        const { id, assetId } = req.params;
        await prisma_1.prisma.assetOnCategory.deleteMany({ where: { categoryId: id, assetId } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to remove' });
    }
};
exports.removeAssetFromCategory = removeAssetFromCategory;
// NEW: Create Category
const createCategory = async (req, res) => {
    try {
        const { name, group } = req.body;
        // Check for duplicate
        const existing = await prisma_1.prisma.category.findUnique({ where: { name } });
        if (existing) {
            res.status(400).json({ message: 'Category already exists' });
            return;
        }
        const category = await prisma_1.prisma.category.create({
            data: {
                name,
                // Default to 'Inspiration' if not specified, or force user to choose
                group: group || 'Inspiration'
            }
        });
        res.status(201).json(category);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating category' });
    }
};
exports.createCategory = createCategory;
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        // Optional: Check if admin/editor (Handled by middleware usually, or check user role here)
        // For now, we rely on the route protection.
        // Delete connections first (AssetOnCategory)
        await prisma_1.prisma.assetOnCategory.deleteMany({ where: { categoryId: id } });
        // Delete the category
        await prisma_1.prisma.category.delete({ where: { id } });
        res.json({ success: true });
    }
    catch (error) {
        console.error("Delete Category Error:", error);
        res.status(500).json({ message: 'Failed to delete category' });
    }
};
exports.deleteCategory = deleteCategory;
const storage_service_1 = require("../services/storage.service"); // Import this
const fs_extra_1 = __importDefault(require("fs-extra"));
// ... existing functions ...
// 7. UPDATE CATEGORY (Rename or Change Cover)
const updateCategory = async (req, res) => {
    const multerReq = req;
    const { id } = req.params;
    const { name, group } = req.body;
    try {
        let coverImagePath = undefined;
        // Handle File Upload if present
        if (multerReq.file) {
            const { path: tempPath, filename, mimetype } = multerReq.file;
            // Upload to Supabase (Categories folder)
            coverImagePath = await (0, storage_service_1.uploadToSupabase)(tempPath, `categories/${filename}`, mimetype);
            // Cleanup local file
            await fs_extra_1.default.remove(tempPath);
        }
        const category = await prisma_1.prisma.category.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(group && { group }),
                ...(coverImagePath && { coverImage: coverImagePath }) // Only update if new file
            }
        });
        res.json(category);
    }
    catch (error) {
        console.error("Update Category Error:", error);
        res.status(500).json({ message: 'Failed to update category' });
    }
};
exports.updateCategory = updateCategory;
