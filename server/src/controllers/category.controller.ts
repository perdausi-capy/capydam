import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Get All Categories (Grouped)
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch categories' }); }
};

// Get Single Category with Assets
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        assets: {
          include: {
            asset: { include: { uploadedBy: { select: { name: true } } } }
          }
        }
      }
    });
    if (!category) { res.status(404).json({ error: 'Category not found' }); return; }
    
    // Flatten structure
    const flatCategory = { ...category, assets: category.assets.map(a => a.asset) };
    res.json(flatCategory);
  } catch (error) { res.status(500).json({ error: 'Server error' }); }
};

// Add Asset to Category
export const addAssetToCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Category ID
    const { assetId } = req.body;
    await prisma.assetOnCategory.create({ data: { categoryId: id, assetId } });
    res.json({ success: true });
  } catch (error) { res.json({ success: true }); } // Ignore duplicates
};

// Remove Asset from Category
export const removeAssetFromCategory = async (req: Request, res: Response) => {
  try {
    const { id, assetId } = req.params;
    await prisma.assetOnCategory.deleteMany({ where: { categoryId: id, assetId } });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Failed to remove' }); }
};

// NEW: Create Category
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, group } = req.body;
    
    // Check for duplicate
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
        res.status(400).json({ message: 'Category already exists' });
        return;
    }

    const category = await prisma.category.create({
      data: {
        name,
        // Default to 'Inspiration' if not specified, or force user to choose
        group: group || 'Inspiration' 
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating category' });
  }
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Optional: Check if admin/editor (Handled by middleware usually, or check user role here)
    // For now, we rely on the route protection.

    // Delete connections first (AssetOnCategory)
    await prisma.assetOnCategory.deleteMany({ where: { categoryId: id } });
    
    // Delete the category
    await prisma.category.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error("Delete Category Error:", error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
};

import { uploadToSupabase } from '../services/storage.service'; // Import this
import path from 'path';
import fs from 'fs-extra';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// ... existing functions ...

// 7. UPDATE CATEGORY (Rename or Change Cover)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;
  const { id } = req.params;
  const { name, group } = req.body;

  try {
    let coverImagePath = undefined;

    // Handle File Upload if present
    if (multerReq.file) {
        const { path: tempPath, filename, mimetype } = multerReq.file;
        
        // Upload to Supabase (Categories folder)
        coverImagePath = await uploadToSupabase(
            tempPath,
            `categories/${filename}`,
            mimetype
        );
        
        // Cleanup local file
        await fs.remove(tempPath);
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(group && { group }),
        ...(coverImagePath && { coverImage: coverImagePath }) // Only update if new file
      }
    });

    res.json(category);
  } catch (error) {
    console.error("Update Category Error:", error);
    res.status(500).json({ message: 'Failed to update category' });
  }
};