import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

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
        role: role || 'viewer', // Default to viewer if not specified
      },
    });

    // 4. Return success (exclude password)
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

    // --- NEW CHECK ---
    if (user.status === 'PENDING') {
      res.status(403).json({ message: 'Account pending approval by Admin.' });
      return;
    }
    // -----------------

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

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

// DELETE /api/auth/users/:id/reject
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

// ✅ NEW: SSO Callback Handler
export const googleCallback = (req: Request, res: Response) => {
  // Passport puts the user in req.user
  const user = req.user as any;

  if (!user) {
    return res.redirect('http://localhost:5173/login?error=Unauthorized');
  }

  // Generate JWT (Same logic as your normal login)
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );

  // Redirect back to Frontend with Token
  // Note: In production, consider using HttpOnly cookies for better security
  res.redirect(`http://65.109.234.134/login?token=${token}`);
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Exclude password
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};