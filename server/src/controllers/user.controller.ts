import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { uploadToSupabase } from '../utils/supabase'; // ✅ Ensure this file exists
import fs from 'fs-extra'; 

// Define Multer Request Type locally to avoid TS errors
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: { id: string };
}

// 1. Get All Users (Admin Dashboard)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: { 
        id: true, 
        name: true, 
        email: true, 
        role: true, 
        status: true, 
        createdAt: true,
        avatar: true // ✅ Make sure you ran 'npx prisma db push' so this column exists
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
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

// 4. Update Role (For existing active users)
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body;

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

// ✅ 6. Update Profile (Name & Avatar)
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const multerReq = req as MulterRequest;
  
  // 🔍 DEBUG: Log to see what we are receiving
  // console.log("User in Controller:", (req as any).user);

  // 🛡️ SAFETY CHECK: Force cast to 'any' to ensure we capture the user attached by middleware
  const user = (req as any).user;
  const userId = user?.id;
  const { name } = req.body;

  // 🛑 STOP if no user found (Prevents the Prisma Crash)
  if (!userId) {
     res.status(401).json({ message: 'User not authenticated or ID missing' });
     return;
  }

  try {
    let avatarPath = undefined;

    // Handle Avatar Upload
    if (multerReq.file) {
      const { path: tempPath, mimetype } = multerReq.file;
      
      // Upload to 'avatars' folder
      avatarPath = await uploadToSupabase(
        tempPath, 
        `avatars/${userId}-${Date.now()}`, 
        mimetype
      );

      // Cleanup local temp file
      await fs.remove(tempPath).catch(() => {});
    }

    // Update Database
    const updatedUser = await prisma.user.update({
      where: { id: userId }, // ✅ userId is now guaranteed to exist here
      data: {
        name: name,
        ...(avatarPath && { avatar: avatarPath }), 
      },
    });

    // Exclude password from response
    const { password, ...userWithoutPassword } = updatedUser;

    res.json(userWithoutPassword);

  } catch (error) {
    console.error("Profile Update Error:", error);
    // Cleanup if file exists but DB failed
    if (multerReq.file?.path) {
        await fs.remove(multerReq.file.path).catch(() => {});
    }
    res.status(500).json({ message: 'Failed to update profile' });
  }
};


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

    // Remove password
    const { password, ...userData } = user;
    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user details' });
  }
};
  
// 8. Delete Active User
// ... other imports

// 8. Delete Active User (Robust Fix)
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const currentUserId = (req as any).user?.id;
    if (id === currentUserId) {
        res.status(400).json({ message: 'You cannot delete your own admin account.' });
        return;
    }

    // 1. Find all assets uploaded by this user (to get their IDs)
    const userAssets = await prisma.asset.findMany({
        where: { userId: id },
        select: { id: true }
    });
    
    const assetIds = userAssets.map(a => a.id);

    // 2. Perform Clean-up Transaction
    await prisma.$transaction([
        
        // A. Remove ALL links to the user's assets from ANY collection
        // (This fixes the "Foreign Key Constraint" error on Assets)
        prisma.assetOnCollection.deleteMany({
            where: {
                assetId: { in: assetIds }
            }
        }),

        // B. Clear the user's OWN collections (remove assets inside them)
        prisma.assetOnCollection.deleteMany({
            where: {
                collection: { userId: id }
            }
        }),

        // C. Delete the User's Collections
        prisma.collection.deleteMany({
            where: { userId: id }
        }),

        // D. Delete the User's Assets
        prisma.asset.deleteMany({
            where: { userId: id }
        }),

        // E. Finally, Delete the User
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