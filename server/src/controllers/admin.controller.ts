import { Request, Response } from 'express';
import { prisma } from '../lib/prisma'; 

// This function fetches counts for the Admin Sidebar Badges
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    // 1. Count Pending Users (Run first)
    const pendingUsers = await prisma.user.count({
      where: { status: 'PENDING' }
    });

    // 2. Count New Feedback (Run second, reusing the connection)
    const newFeedback = await prisma.feedback.count({
      where: { status: 'new' }
    });

    res.json({
      pendingUsers,
      newFeedback
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
};