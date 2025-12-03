import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// 1. Create a Collection
export const createCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    // Simple slug generator: "Summer Vibes" -> "summer-vibes"
    const slug = name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

    const collection = await prisma.collection.create({
      data: { name, slug },
    });

    res.status(201).json(collection);
  } catch (error) {
    res.status(400).json({ message: 'Collection already exists or invalid name' });
  }
};

// 2. Get All Collections
export const getCollections = async (req: Request, res: Response): Promise<void> => {
  try {
    const collections = await prisma.collection.findMany({
      include: { 
        _count: { select: { assets: true } } // Return asset count for UI
      }
    });
    res.json(collections);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 3. Get One Collection (with Assets)
export const getCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        assets: {
          include: { asset: true } // Join the actual Asset data
        }
      }
    });

    if (!collection) {
      res.status(404).json({ message: 'Collection not found' });
      return;
    }

    // Flatten structure for Frontend: [ { asset: {...} }, ... ] -> [ {...} ]
    const flattenedAssets = collection.assets.map(item => item.asset);
    
    res.json({ ...collection, assets: flattenedAssets });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// 4. Add Asset to Collection
export const addAssetToCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Collection ID
    const { assetId } = req.body;

    await prisma.assetOnCollection.create({
      data: {
        collectionId: id,
        assetId: assetId,
      },
    });

    res.json({ message: 'Asset added to collection' });
  } catch (error) {
    // Unique constraint violation means it's already in the collection
    res.status(400).json({ message: 'Asset already in collection' });
  }
};

// 5. Remove Asset from Collection
export const removeAssetFromCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, assetId } = req.params; // Note: assetId passed in URL for delete

    await prisma.assetOnCollection.delete({
      where: {
        assetId_collectionId: {
          assetId,
          collectionId: id,
        },
      },
    });

    res.json({ message: 'Asset removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing asset' });
  }
};