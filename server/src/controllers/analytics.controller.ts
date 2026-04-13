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

    // 🌟 SMART TRIGGER: Automatically increment Asset Counters!
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

// ✅ 3. The Bento Box Dashboard Aggregator
export const getSystemAnalytics = async (req: Request, res: Response) => {
  try {
    // 1. Storage & Assets (Fixed: Use mimeType instead of fileType)
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

    // 2. Users Data
    const users = await prisma.user.findMany({ select: { role: true, id: true } });
    const userStats = {
      total: users.length,
      admins: users.filter(u => u.role === 'ADMIN').length,
      editors: users.filter(u => u.role === 'EDITOR').length,
      viewers: users.filter(u => u.role === 'VIEWER').length,
    };

    // 3. Traffic & Visits
    const totalVisits = await prisma.siteVisit.count();

    // 4. Live Audit Trail (Latest 50 actions)
    const recentUserLogs = await prisma.userLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { 
        user: { select: { name: true, email: true, avatar: true } },
        asset: { select: { originalName: true } }
      }
    });

    // 5. Leaderboard: Top Downloaded Assets
    const popularAssets = await prisma.asset.findMany({
      take: 5,
      orderBy: { downloadCount: 'desc' },
      select: { id: true, originalName: true, downloadCount: true, viewCount: true, mimeType: true }
    });

// 6. Leaderboard: Top Uploaders
const topUploaders = await prisma.user.findMany({
  take: 5,
  orderBy: { assets: { _count: 'desc' } },
  select: { id: true, name: true, avatar: true, _count: { select: { assets: true } } }
});

// ✅ FIXED: Actually fetch the 10 most recent uploads
// ✅ FIXED: Use the correct relation name (likely 'uploadedBy')
const recentUploads = await prisma.asset.findMany({
  take: 10,
  orderBy: { createdAt: 'desc' },
  // 👇 Change 'user' to whatever the relation is called in schema.prisma!
  include: { uploadedBy: { select: { name: true } } } 
});

const formattedRecentActivity = recentUploads.map((a: any) => ({
    id: a.id,
    originalName: a.originalName,
    size: a.size,
    createdAt: a.createdAt.toISOString(),
    // 👇 Update this to match the relation name too
    uploadedBy: { name: a.uploadedBy?.name || 'Unknown' } 
}));

// ✅ NEW: Fetch all users WITH their last activity date
const rawUsers = await prisma.user.findMany({
  select: {
      id: true, name: true, email: true, avatar: true, role: true,
      userLogs: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } }
  },
  orderBy: { name: 'asc' }
});

const allUsersList = rawUsers.map((u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatar: u.avatar,
  role: u.role,
  lastActive: u.userLogs[0]?.createdAt ? u.userLogs[0].createdAt.toISOString() : null
}));

res.json({
storage: { totalBytes, totalAssets },
breakdown,
users: userStats,
visits: { total: totalVisits },
recentUserLogs,
popularAssets,
topUploaders,
recentActivity: formattedRecentActivity, 
allUsers: allUsersList                   // Now includes lastActive!
});

} catch (error) {
console.error("Analytics Error:", error);
res.status(500).json({ message: 'Error fetching analytics' });
}
};

// ✅ NEW: Fetch ALL actions for a specific user
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