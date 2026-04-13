"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCategory = exports.deleteCategory = exports.createCategory = exports.removeAssetFromCategory = exports.addAssetToCategory = exports.getCategoryById = exports.getCategories = void 0;
const prisma_1 = require("../lib/prisma");
const storage_service_1 = require("../services/storage.service");
const fs_extra_1 = __importDefault(require("fs-extra"));
// 1. Get All Categories (Grouped)
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
// 2. Get Single Category with Assets
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
// 3. Add Asset to Category
const addAssetToCategory = async (req, res) => {
    try {
        const { id } = req.params; // Category ID
        const { assetId } = req.body;
        await prisma_1.prisma.assetOnCategory.create({ data: { categoryId: id, assetId } });
        res.json({ success: true });
    }
    catch (error) {
        res.json({ success: true }); // Ignore duplicates
    }
};
exports.addAssetToCategory = addAssetToCategory;
// 4. Remove Asset from Category
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
// 5. Create Category (With Cover Image & Link Support)
const createCategory = async (req, res) => {
    const multerReq = req;
    try {
        // 1. Extract text fields from FormData
        const { name, group, link } = req.body;
        if (!name) {
            res.status(400).json({ message: 'Category name is required' });
            return;
        }
        // 2. Check for duplicate name
        const existing = await prisma_1.prisma.category.findUnique({ where: { name } });
        if (existing) {
            // Cleanup file if it was uploaded but name exists
            if (multerReq.file?.path)
                await fs_extra_1.default.remove(multerReq.file.path).catch(() => { });
            res.status(400).json({ message: 'Category already exists' });
            return;
        }
        let coverImagePath = null;
        // 3. Handle Cover Image Upload
        if (multerReq.file) {
            const { path: tempPath, filename, mimetype } = multerReq.file;
            try {
                coverImagePath = await (0, storage_service_1.uploadToSupabase)(tempPath, `categories/${filename}`, mimetype);
            }
            finally {
                // Always cleanup temp file
                await fs_extra_1.default.remove(tempPath).catch(() => { });
            }
        }
        // 4. Create in Database
        const category = await prisma_1.prisma.category.create({
            data: {
                name,
                // Default to 'Inspiration' if not specified
                group: group || 'Inspiration',
                // Save the external link if provided
                link: link || null,
                coverImage: coverImagePath
            }
        });
        res.status(201).json(category);
    }
    catch (error) {
        console.error("Create Category Error:", error);
        // Cleanup file if DB insert failed
        if (multerReq.file?.path) {
            await fs_extra_1.default.remove(multerReq.file.path).catch(() => { });
        }
        res.status(500).json({ message: 'Error creating category' });
    }
};
exports.createCategory = createCategory;
// 6. Delete Category
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
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
// 7. UPDATE CATEGORY (Rename, Change Cover, Update Link)
const updateCategory = async (req, res) => {
    const multerReq = req;
    const { id } = req.params;
    const { name, group, link } = req.body;
    try {
        let coverImagePath = undefined;
        // 1. Handle File Upload (If a new cover is provided)
        if (multerReq.file) {
            const { path: tempPath, filename, mimetype } = multerReq.file;
            try {
                coverImagePath = await (0, storage_service_1.uploadToSupabase)(tempPath, `categories/${filename}`, mimetype);
            }
            finally {
                await fs_extra_1.default.remove(tempPath).catch(() => { });
            }
        }
        // 2. Prepare Update Data
        // We sanitize 'link' because FormData turns null/undefined into strings
        const updateData = {};
        if (name)
            updateData.name = name;
        if (group)
            updateData.group = group;
        if (coverImagePath)
            updateData.coverImage = coverImagePath;
        // Logic: If 'link' is sent, update it. If it's a "falsy" string, set it to null.
        if (link !== undefined) {
            if (link === 'null' || link === 'undefined' || link === '') {
                updateData.link = null; // Clear the link
            }
            else {
                updateData.link = link; // Update with new URL
            }
        }
        // 3. Execute Update
        const category = await prisma_1.prisma.category.update({
            where: { id },
            data: updateData
        });
        res.json(category);
    }
    catch (error) {
        console.error("Update Category Error:", error);
        // Cleanup file if DB update failed
        if (multerReq.file?.path) {
            await fs_extra_1.default.remove(multerReq.file.path).catch(() => { });
        }
        res.status(500).json({ message: 'Failed to update category' });
    }
};
exports.updateCategory = updateCategory;
