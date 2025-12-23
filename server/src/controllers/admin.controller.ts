import { Request, Response } from 'express';
import { prisma } from '../lib/prisma'; 

// This function fetches counts for the Admin Sidebar Badges
export const getAdminStats = async (req: Request, res: Response) => {
  try {
    // Run both queries at the same time for speed
    const [pendingUsers, newFeedback] = await Promise.all([
      // Count Pending Users
      prisma.user.count({
        where: { status: 'PENDING' }
      }),
      // Count New Feedback
      prisma.feedback.count({
        where: { status: 'new' }
      })
    ]);

    res.json({
      pendingUsers,
      newFeedback
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
};