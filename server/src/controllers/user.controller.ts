import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

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
        createdAt: true 
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
    const { role } = req.body; // Admin selects role here

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
    // We simply delete the user request
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

    // Check if exists
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
        status: 'ACTIVE', // Admin created users are auto-active
      },
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error creating user' });
  }
};