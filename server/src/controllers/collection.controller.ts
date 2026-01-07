import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';

// Helper to generate slug
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
};

// 1. GET ALL (Super Optimized)
export const getCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;
    const targetUserId = req.query.targetUserId as string;

    const whereClause: any = {
      parentId: null
    };

    // ✅ LOGIC: Admin view vs User view
    if (userRole === 'admin' && targetUserId) {
        whereClause.userId = targetUserId;
    } else {
        whereClause.userId = userId;
    }

    // ⚡️ OPTIMIZATION: 
    // 1. We fetch 'coverImage' directly from the column (No heavy joins!)
    // 2. We limit to 100 to prevent server overload
    const collections = await prisma.collection.findMany({
      where: whereClause,
      take: 100, 
      select: {
        id: true,
        name: true,
        createdAt: true,
        coverImage: true, // Direct column access (Fast!)
        _count: {
          select: { assets: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(collections);
  } catch (error) {
    console.error("Get Collections Error:", error);
    res.status(500).json({ message: 'Error fetching collections' });
  }
};

// 2. GET ONE (Unchanged)
export const getCollectionById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
  
      const collection = await prisma.collection.findUnique({
        where: { id },
        include: {
            children: {
                include: { _count: { select: { assets: true } } }
            },
            assets: {
                include: {
                    asset: {
                        include: { uploadedBy: { select: { name: true } } }
                    }
                }
            }
        }
      });
  
      if (!collection) {
        res.status(404).json({ message: 'Collection not found' });
        return;
      }

      if (userRole !== 'admin' && collection.userId !== userId) {
          res.status(403).json({ message: 'Access denied' });
          return;
      }
  
      // Flatten structure for frontend convenience
      const flatCollection = {
          ...collection,
          assets: collection.assets.map(a => a.asset)
      };
  
      res.json(flatCollection);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};

// 3. CREATE (Optimized: Fail-Fast Strategy)
export const createCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, parentId } = req.body;
    const userId = (req as any).user?.id;
    
    const baseSlug = slugify(name);
    let slug = baseSlug;

    // ⚡️ OPTIMIZATION: Try to create immediately. 
    // We assume the name is unique most of the time.
    // This saves 1 DB call (findUnique) for every successful creation.
    try {
        const collection = await prisma.collection.create({
            data: {
                name,
                slug,
                userId,
                parentId: parentId || null
            }
        });
        res.status(201).json(collection);
        return;

    } catch (dbError: any) {
        // P2002 = Unique Constraint Failed (Slug collision)
        if (dbError.code === 'P2002') {
            // Collision happened! Now append timestamp and retry.
            slug = `${baseSlug}-${Date.now()}`;
            const collectionRetry = await prisma.collection.create({
                data: {
                    name,
                    slug,
                    userId,
                    parentId: parentId || null
                }
            });
            res.status(201).json(collectionRetry);
            return;
        }
        throw dbError; // Throw other errors to the main catch block
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating collection' });
  }
};

// 4. ADD ASSET TO COLLECTION (Auto-update Cover)
export const addAssetToCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params; 
        const { assetId } = req.body;
        const userId = (req as any).user?.id;
        const userRole = (req as any).user?.role;

        // 1. Fetch Collection to check rights & current cover status
        const collection = await prisma.collection.findUnique({ 
            where: { id },
            select: { userId: true, coverImage: true } 
        });
        
        if (!collection) { res.status(404).json({ message: 'Not found' }); return; }
        
        if (userRole !== 'admin' && collection.userId !== userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
        }

        // 2. Fetch the Asset details (we need the path for the cover)
        const asset = await prisma.asset.findUnique({ 
            where: { id: assetId },
            select: { thumbnailPath: true, path: true }
        });

        if (!asset) { res.status(404).json({ message: 'Asset not found' }); return; }

        // 3. Prepare Transaction Operations
        const operations: any[] = [
            prisma.assetOnCollection.create({
                data: { collectionId: id, assetId }
            })
        ];

        // ✅ LOGIC: If collection has no cover, use this new asset immediately
        if (!collection.coverImage) {
            const newCover = asset.thumbnailPath || asset.path;
            operations.push(
                prisma.collection.update({
                    where: { id },
                    data: { coverImage: newCover }
                })
            );
        }

        // Execute all updates atomically
        await prisma.$transaction(operations);

        res.json({ success: true });
    } catch (error) {
        // Ignore P2002 (Duplicate entry) - means asset is already in collection
        res.json({ success: true });
    }
};

// 5. REMOVE ASSET (Recalculate Cover if needed)
export const removeAssetFromCollection = async (req: Request, res: Response): Promise<void> => {
  try {
      const { id, assetId } = req.params;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;

      const collection = await prisma.collection.findUnique({ where: { id } });
      if (!collection) { res.status(404).json({ message: 'Not found' }); return; }

      if (userRole !== 'admin' && collection.userId !== userId) {
          res.status(403).json({ message: 'Access denied' });
          return;
      }

      // 1. Get the asset we are about to remove (to check if it's the cover)
      const assetToRemove = await prisma.asset.findUnique({
          where: { id: assetId },
          select: { thumbnailPath: true, path: true }
      });

      // 2. Remove the link
      await prisma.assetOnCollection.deleteMany({
          where: { collectionId: id, assetId: assetId }
      });

      // 3. ✅ CHECK: Did we just delete the cover image?
      const currentCover = collection.coverImage;
      const removedImage = assetToRemove?.thumbnailPath || assetToRemove?.path;

      if (currentCover && removedImage && currentCover === removedImage) {
          
          // Find the most recent asset remaining in the collection
          // ✅ FIX: Use 'assignedAt' instead of 'createdAt'
          const nextAssetLink = await prisma.assetOnCollection.findFirst({
              where: { collectionId: id },
              include: { asset: { select: { thumbnailPath: true, path: true } } },
              orderBy: { assignedAt: 'desc' } 
          });

          // If found, use it. If not (folder empty), set to null.
          const newCover = nextAssetLink?.asset.thumbnailPath || nextAssetLink?.asset.path || null;

          await prisma.collection.update({
              where: { id },
              data: { coverImage: newCover }
          });
      }

      res.json({ success: true });
  } catch (error) {
      console.error("Remove Asset Error:", error);
      res.status(500).json({ message: 'Error removing asset' });
  }
};

// 6. UPDATE COLLECTION (Rename)
export const updateCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    const collection = await prisma.collection.findUnique({ where: { id } });
    if (!collection) { res.status(404).json({ message: 'Collection not found' }); return; }

    if (userRole !== 'admin' && collection.userId !== userId) {
        res.status(403).json({ message: 'Access denied' });
        return;
    }

    const updated = await prisma.collection.update({
        where: { id },
        data: { name }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating collection' });
  }
};

// 7. DELETE COLLECTION (Recursive Force Delete)
export const deleteCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role;

    // 1. Fetch the collection AND all its children (recursive) to check permissions
    // Note: A simple check is enough, we will let the DB cascade handle the deep structure
    // provided we clean up the Asset links first.
    const collection = await prisma.collection.findUnique({ where: { id } });

    if (!collection) {
        res.status(404).json({ message: 'Collection not found' });
        return;
    }

    if (userRole !== 'admin' && collection.userId !== userId) {
        res.status(403).json({ message: 'Access denied' });
        return;
    }

    // 2. FORCE DELETE STRATEGY
    // We need to find ALL descendent collection IDs to remove their AssetOnCollection links first.
    // Prisma doesn't support recursive deleteMany easily, so we fetch IDs first.
    
    // Get all collections owned by this user (optimization: we assume we only delete our own tree)
    const allUserCollections = await prisma.collection.findMany({
        where: { userId: collection.userId },
        select: { id: true, parentId: true }
    });

    // Helper to find all descendants of the target ID
    const getDescendants = (parentId: string): string[] => {
        const children = allUserCollections.filter(c => c.parentId === parentId);
        let ids = children.map(c => c.id);
        children.forEach(c => {
            ids = [...ids, ...getDescendants(c.id)];
        });
        return ids;
    };

    const targetIds = [id, ...getDescendants(id)];

    // 3. TRANSACTION
    await prisma.$transaction([
        // A. Remove all asset links from the target folder AND all sub-folders
        prisma.assetOnCollection.deleteMany({
            where: { collectionId: { in: targetIds } }
        }),
        
        // B. Delete the parent collection. 
        // Since schema has `onDelete: Cascade` for `children`, this wipes the sub-folders automatically.
        prisma.collection.delete({
            where: { id }
        })
    ]);

    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    console.error("Delete Collection Error:", error);
    res.status(500).json({ message: 'Error deleting collection' });
  }
};