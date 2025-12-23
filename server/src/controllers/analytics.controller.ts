import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getSystemAnalytics = async (req: Request, res: Response) => {
  try {
    // 1. Total Storage & Asset Count
    // Aggregates the 'size' column of all assets
    const storageStats = await prisma.asset.aggregate({
      _sum: { size: true },
      _count: { id: true }
    });

    // 2. User Stats
    const totalUsers = await prisma.user.count();
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    const editorCount = await prisma.user.count({ where: { role: 'editor' } });

    // 3. Asset Breakdown by Type (Image, Video, Audio, Doc)
    // We fetch counts based on mimeType prefixes
    const [images, videos, audio, docs] = await Promise.all([
      prisma.asset.count({ where: { mimeType: { startsWith: 'image/' } } }),
      prisma.asset.count({ where: { mimeType: { startsWith: 'video/' } } }),
      prisma.asset.count({ where: { mimeType: { startsWith: 'audio/' } } }),
      prisma.asset.count({ where: { mimeType: { equals: 'application/pdf' } } })
    ]);

    // 4. Recent Activity (Last 5 Uploads)
    const recentUploads = await prisma.asset.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        size: true,
        createdAt: true,
        uploadedBy: { select: { name: true } }
      }
    });

    // 5. ✅ NEW: Last Active Users (Last 8 logins/updates)
    const recentUsers = await prisma.user.findMany({
      take: 8,
      orderBy: { updatedAt: 'desc' }, // Sorts by last profile update/login
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        updatedAt: true,
        avatar: true // Helpful if you want to show user icons later
      }
    });

    // Helper: Format Bytes to GB/MB
    const totalBytes = storageStats._sum.size || 0;
    
    res.json({
      storage: {
        totalBytes,
        totalAssets: storageStats._count.id,
      },
      users: {
        total: totalUsers,
        admins: adminCount,
        editors: editorCount,
        viewers: totalUsers - (adminCount + editorCount)
      },
      breakdown: {
        images,
        videos,
        audio,
        docs,
        others: storageStats._count.id - (images + videos + audio + docs)
      },
      recentActivity: recentUploads,
      recentUsers // ✅ Added to response
    });

  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
};