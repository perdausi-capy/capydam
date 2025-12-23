import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { uploadToSupabase } from '../utils/supabase'; 
import fs from 'fs-extra'; 

// Define Multer Request Type locally
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: { id: string };
}

// ✅ 1. Get All Users
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const role = (req.query.role as string) || 'all';

    const skip = (page - 1) * limit;

    const whereClause: any = {
      AND: [
        search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        } : {},
        role !== 'all' ? { role: role } : {},
      ],
    };

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        select: { 
          id: true, 
          name: true, 
          email: true, 
          role: true, 
          status: true, 
          createdAt: true,
          updatedAt: true, // ✅ ADDED THIS LINE
          avatar: true 
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// 2. Approve User Request
export const approveUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body; 

    await prisma.user.update({
      where: { id },
      data: { 
        status: 'ACTIVE',
        role: role || 'viewer' 
      },
    });

    res.json({ message: 'User approved and active' });
  } catch (error) {
    res.status(500).json({ message: 'Error approving user' });
  }
};

// 3. Reject User Request
export const rejectUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User request rejected and removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting user' });
  }
};

// 4. Update Role (Safe Version)
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Safety: Ensure only valid roles are passed
    const validRoles = ['admin', 'editor', 'viewer'];
    if (!validRoles.includes(role)) {
        res.status(400).json({ message: 'Invalid role provided' });
        return;
    }

    await prisma.user.update({
      where: { id },
      data: { role },
    });

    res.json({ message: 'User role updated' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating role' });
  }
};

// 5. Create User (Admin Action)
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        status: 'ACTIVE', 
      },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error creating user' });
  }
};

// 6. Update Profile (Preserved & Safe)
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;
  const user = (req as any).user;
  const userId = user?.id;
  const { name } = req.body;

  if (!userId) {
     res.status(401).json({ message: 'User not authenticated or ID missing' });
     return;
  }

  try {
    let avatarPath = undefined;

    if (multerReq.file) {
      const { path: tempPath, mimetype } = multerReq.file;
      
      avatarPath = await uploadToSupabase(
        tempPath, 
        `avatars/${userId}-${Date.now()}`, 
        mimetype
      );

      await fs.remove(tempPath).catch(() => {});
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name,
        ...(avatarPath && { avatar: avatarPath }), 
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    res.json(userWithoutPassword);

  } catch (error) {
    console.error("Profile Update Error:", error);
    if (multerReq.file?.path) {
        await fs.remove(multerReq.file.path).catch(() => {});
    }
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// 7. Get Single User Details
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assets: true, collections: true }
        },
        assets: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, originalName: true, mimeType: true, thumbnailPath: true, createdAt: true }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { password, ...userData } = user;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user details' });
  }
};
  
// 8. Delete User (Transaction Safe)
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const currentUserId = (req as any).user?.id;
    if (id === currentUserId) {
        res.status(400).json({ message: 'You cannot delete your own admin account.' });
        return;
    }

    const userAssets = await prisma.asset.findMany({
        where: { userId: id },
        select: { id: true }
    });
    
    const assetIds = userAssets.map(a => a.id);

    await prisma.$transaction([
        // Remove asset links in collections
        prisma.assetOnCollection.deleteMany({
            where: { assetId: { in: assetIds } }
        }),
        // Remove collections owned by user
        prisma.assetOnCollection.deleteMany({
            where: { collection: { userId: id } }
        }),
        prisma.collection.deleteMany({
            where: { userId: id }
        }),
        // Remove assets owned by user
        prisma.asset.deleteMany({
            where: { userId: id }
        }),
        // Finally, delete user
        prisma.user.delete({
            where: { id }
        })
    ]);

    res.json({ message: 'User and all associated data deleted successfully' });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ message: 'Error deleting user. Ensure all dependencies are cleared.' });
  }
};