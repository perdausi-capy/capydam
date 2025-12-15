import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'; // ✅ Defaults to local if missing

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;

    // 1. Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'viewer', 
        status: 'PENDING', // Recommended: Default new registrations to PENDING
      },
    });

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    // --- CHECK STATUS ---
    if (user.status === 'PENDING') {
      res.status(403).json({ message: 'Account pending approval by Admin.' });
      return;
    }

    // --- 🛡️ SSO SAFETY CHECK ---
    // If user registered via SSO, they won't have a password. 
    // This prevents bcrypt from crashing on null.
    if (!user.password) {
        res.status(400).json({ message: 'Please login with Google/SSO.' });
        return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// PATCH /api/auth/users/:id/approve
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

// DELETE /api/auth/users/:id/reject
export const rejectUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User request rejected and removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting user' });
  }
};

// ✅ SSO Callback Handler (Updated for Prod)
export const googleCallback = (req: Request, res: Response) => {
  const user = req.user as any;

  if (!user) {
    // Redirect to the Dynamic Client URL
    return res.redirect(`${CLIENT_URL}/login?error=Unauthorized`);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // ✅ Redirect to Dynamic Client URL
  res.redirect(`${CLIENT_URL}/login?token=${token}`);
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Handle user with no password (SSO) safely
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};