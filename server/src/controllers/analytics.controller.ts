import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ✅ 1. Record an Anonymous or Logged-In Site Visit
export const recordSiteVisit = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || null;
    const userAgent = req.headers['user-agent'] || 'Unknown';
    await prisma.siteVisit.create({ data: { userId, userAgent } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
};

// ✅ 2. The Master Log Catcher (Handles Logs & Counters)
export const recordUserLog = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { action, details, assetId, duration, metadata } = req.body;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    // Create the master audit log
    await prisma.userLog.create({
      data: { userId, action, details, assetId, duration, metadata }
    });

    // SMART TRIGGER: Automatically increment Asset Counters!
    if (assetId && action === 'DOWNLOAD') {
      await prisma.asset.update({ where: { id: assetId }, data: { downloadCount: { increment: 1 } } });
    } else if (assetId && action === 'VIEW_ASSET') {
      await prisma.asset.update({ where: { id: assetId }, data: { viewCount: { increment: 1 } } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Log Error:", error);
    res.status(500).json({ success: false });
  }
};

// ✅ 3. The Enterprise Command Center Aggregator
export const getSystemAnalytics = async (req: Request, res: Response) => {
  try {
    // 1. Storage & Assets Breakdown
    const assets = await prisma.asset.findMany({ select: { size: true, mimeType: true } });
    const totalAssets = assets.length;
    const totalBytes = assets.reduce((sum, asset) => sum + (asset.size || 0), 0);

    const breakdown = {
      images: assets.filter(a => a.mimeType && a.mimeType.startsWith('image/')).length,
      videos: assets.filter(a => a.mimeType && a.mimeType.startsWith('video/')).length,
      audio: assets.filter(a => a.mimeType && a.mimeType.startsWith('audio/')).length,
      docs: assets.filter(a => a.mimeType && (a.mimeType.includes('pdf') || a.mimeType.includes('document'))).length,
      others: 0
    };
    breakdown.others = totalAssets - (breakdown.images + breakdown.videos + breakdown.audio + breakdown.docs);

    // 2. Platform Members Data
    const users = await prisma.user.findMany({ select: { role: true, id: true } });
    const userStats = {
      total: users.length,
      admins: users.filter(u => u.role.toLowerCase().includes('admin')).length,
      editors: users.filter(u => u.role.toLowerCase() === 'editor').length,
      viewers: users.filter(u => u.role.toLowerCase() === 'viewer').length,
    };

    // 3. Platform Velocity & Traffic
    const totalVisits = await prisma.userLog.count({
        where: { action: { in: ['LOGIN', 'SITE_VISIT'] } }
    });

    // 4. Live Audit Trail
    const recentUserLogs = await prisma.userLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { 
        user: { select: { name: true, email: true, avatar: true } },
        asset: { select: { originalName: true } }
      }
    });

    // 5. Leaderboard
    const topUploaders = await prisma.user.findMany({
      take: 5,
      orderBy: { assets: { _count: 'desc' } },
      select: { id: true, name: true, avatar: true, _count: { select: { assets: true } } }
    });

    // 6. Recent Upload Activity
    const recentUploads = await prisma.asset.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { name: true } } } 
    });

    const formattedRecentActivity = recentUploads.map((a: any) => ({
        id: a.id,
        originalName: a.originalName,
        size: a.size,
        createdAt: a.createdAt.toISOString(),
        uploadedBy: { name: a.uploadedBy?.name || 'Unknown' } 
    }));

    // 7. SMART ENGINE
    const rawUsers = await prisma.user.findMany({
      select: {
          id: true, name: true, email: true, avatar: true, role: true, createdAt: true,
          userLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
          _count: { select: { assets: true } }
      },
      orderBy: { name: 'asc' }
    });

    const allUsersList = rawUsers.map((u: any) => ({
      id: u.id,
      name: u.name || 'Unknown User',
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      uploads: u._count.assets,
      createdDaysAgo: Math.floor((new Date().getTime() - new Date(u.createdAt).getTime()) / (1000 * 3600 * 24)),
      lastActive: u.userLogs[0]?.createdAt ? u.userLogs[0].createdAt.toISOString() : null
    }));

    // 8. 🚀 UPGRADED PLATFORM VELOCITY (Weekly, Monthly, Yearly)
    const now = new Date();
    
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(now.getDate() - 6); sevenDaysAgo.setHours(0,0,0,0);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 29); thirtyDaysAgo.setHours(0,0,0,0);
    const oneYearAgo = new Date(); oneYearAgo.setMonth(now.getMonth() - 11); oneYearAgo.setDate(1); oneYearAgo.setHours(0,0,0,0);

    // Fetch a single bulk log for the last year to save database load
    const velocityLogs = await prisma.userLog.findMany({
      where: {
        createdAt: { gte: oneYearAgo },
        action: { in: ['UPLOAD', 'DOWNLOAD'] }
      },
      select: { action: true, createdAt: true }
    });

    // Generate Blank Maps for perfectly scaled charts
    const weeklyMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      weeklyMap.set(d.toLocaleDateString('en-US', { weekday: 'short' }), { name: d.toLocaleDateString('en-US', { weekday: 'short' }), uploads: 0, downloads: 0 });
    }

    const monthlyMap = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      monthlyMap.set(label, { name: label, uploads: 0, downloads: 0 });
    }

    const yearlyMap = new Map();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      yearlyMap.set(label, { name: label, uploads: 0, downloads: 0 });
    }

    // Populate the maps in a single fast loop
    velocityLogs.forEach(log => {
      const d = new Date(log.createdAt);
      
      if (d >= sevenDaysAgo) {
        const wLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
        if (weeklyMap.has(wLabel)) { log.action === 'UPLOAD' ? weeklyMap.get(wLabel).uploads++ : weeklyMap.get(wLabel).downloads++; }
      }
      if (d >= thirtyDaysAgo) {
        const mLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (monthlyMap.has(mLabel)) { log.action === 'UPLOAD' ? monthlyMap.get(mLabel).uploads++ : monthlyMap.get(mLabel).downloads++; }
      }
      const yLabel = d.toLocaleDateString('en-US', { month: 'short' });
      if (yearlyMap.has(yLabel)) { log.action === 'UPLOAD' ? yearlyMap.get(yLabel).uploads++ : yearlyMap.get(yLabel).downloads++; }
    });

    res.json({
      storage: { totalBytes, totalAssets },
      breakdown,
      users: userStats,
      visits: { total: totalVisits },
      recentUserLogs,
      topUploaders,
      recentActivity: formattedRecentActivity, 
      allUsers: allUsersList,
      velocityChart: {
        weekly: Array.from(weeklyMap.values()),
        monthly: Array.from(monthlyMap.values()),
        yearly: Array.from(yearlyMap.values())
      }
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: 'Error fetching enterprise analytics' });
  }
};

// ✅ 4. Fetch ALL actions for a specific user
export const getUserAuditLogs = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const logs = await prisma.userLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { 
         asset: { select: { originalName: true } } 
      }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch user logs' });
  }
};