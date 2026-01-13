import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { uploadToSupabase } from '../services/storage.service';
import fs from 'fs-extra';

// Define Multer Request Interface
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// 1. Get All Categories (Grouped)
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { assets: true } } },
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (error) { 
    res.status(500).json({ error: 'Failed to fetch categories' }); 
  }
};

// 2. Get Single Category with Assets
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

    if (!category) { 
      res.status(404).json({ error: 'Category not found' }); 
      return; 
    }
    
    // Flatten structure
    const flatCategory = { ...category, assets: category.assets.map(a => a.asset) };
    res.json(flatCategory);
  } catch (error) { 
    res.status(500).json({ error: 'Server error' }); 
  }
};

// 3. Add Asset to Category
export const addAssetToCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Category ID
    const { assetId } = req.body;
    await prisma.assetOnCategory.create({ data: { categoryId: id, assetId } });
    res.json({ success: true });
  } catch (error) { 
    res.json({ success: true }); // Ignore duplicates
  } 
};

// 4. Remove Asset from Category
export const removeAssetFromCategory = async (req: Request, res: Response) => {
  try {
    const { id, assetId } = req.params;
    await prisma.assetOnCategory.deleteMany({ where: { categoryId: id, assetId } });
    res.json({ success: true });
  } catch (error) { 
    res.status(500).json({ error: 'Failed to remove' }); 
  }
};

// 5. Create Category (With Cover Image & Link Support)
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;
  
  try {
    // 1. Extract text fields from FormData
    const { name, group, link } = req.body;

    if (!name) {
      res.status(400).json({ message: 'Category name is required' });
      return;
    }

    // 2. Check for duplicate name
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) {
        // Cleanup file if it was uploaded but name exists
        if (multerReq.file?.path) await fs.remove(multerReq.file.path).catch(() => {});
        
        res.status(400).json({ message: 'Category already exists' });
        return;
    }

    let coverImagePath = null;

    // 3. Handle Cover Image Upload
    if (multerReq.file) {
      const { path: tempPath, filename, mimetype } = multerReq.file;
      try {
        coverImagePath = await uploadToSupabase(
          tempPath,
          `categories/${filename}`,
          mimetype
        );
      } finally {
        // Always cleanup temp file
        await fs.remove(tempPath).catch(() => {});
      }
    }

    // 4. Create in Database
    const category = await prisma.category.create({
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

  } catch (error) {
    console.error("Create Category Error:", error);
    // Cleanup file if DB insert failed
    if (multerReq.file?.path) {
        await fs.remove(multerReq.file.path).catch(() => {});
    }
    res.status(500).json({ message: 'Error creating category' });
  }
};

// 6. Delete Category
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
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

// 7. UPDATE CATEGORY (Rename, Change Cover, Update Link)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;
  const { id } = req.params;
  const { name, group, link } = req.body;

  try {
    let coverImagePath = undefined;

    // 1. Handle File Upload (If a new cover is provided)
    if (multerReq.file) {
      const { path: tempPath, filename, mimetype } = multerReq.file;
      try {
        coverImagePath = await uploadToSupabase(
          tempPath,
          `categories/${filename}`,
          mimetype
        );
      } finally {
        await fs.remove(tempPath).catch(() => {});
      }
    }

    // 2. Prepare Update Data
    // We sanitize 'link' because FormData turns null/undefined into strings
    const updateData: any = {};

    if (name) updateData.name = name;
    if (group) updateData.group = group;
    if (coverImagePath) updateData.coverImage = coverImagePath;

    // Logic: If 'link' is sent, update it. If it's a "falsy" string, set it to null.
    if (link !== undefined) {
        if (link === 'null' || link === 'undefined' || link === '') {
            updateData.link = null; // Clear the link
        } else {
            updateData.link = link; // Update with new URL
        }
    }

    // 3. Execute Update
    const category = await prisma.category.update({
      where: { id },
      data: updateData
    });

    res.json(category);

  } catch (error) {
    console.error("Update Category Error:", error);
    
    // Cleanup file if DB update failed
    if (multerReq.file?.path) {
        await fs.remove(multerReq.file.path).catch(() => {});
    }
    
    res.status(500).json({ message: 'Failed to update category' });
  }
};