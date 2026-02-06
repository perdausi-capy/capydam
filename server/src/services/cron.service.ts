import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { deleteFromSupabase } from './storage.service'; 
import axios from 'axios'; 

const prisma = new PrismaClient();
const EXPIRATION_DAYS = 30;

export const initCronJobs = () => {
  // 1. TRASH CLEANUP: Run every day at Midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('🕒 [CRON] Running scheduled cleanup for expired trash...');
    await cleanupExpiredAssets();
  });

  // 2. DAILY QUEST AUTO-PILOT: Run every day at 9:00 AM
  // (Checks schedule first, then random vault)
  cron.schedule('0 9 * * *', async () => {
    console.log('🕒 [CRON] Starting Daily Quest Auto-Pilot...');
    await launchDailyQuest();
  });

  // 3. SEASON AUTO-PILOT: Run every day at 6:00 AM
  // (Checks if it's the 1st of the month to end the previous season)
  cron.schedule('0 6 * * *', async () => {
    console.log('🕒 [CRON] Checking Season Status...');
    await checkAndEndSeason();
  });

  console.log('✅ Cron jobs initialized');
};

/* =========================================
   TASK 1: TRASH CLEANUP
   ========================================= */
const cleanupExpiredAssets = async () => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - EXPIRATION_DAYS);

    const expiredAssets = await prisma.asset.findMany({
      where: {
        deletedAt: { lt: cutoffDate, not: null }
      }
    });

    if (expiredAssets.length === 0) return;

    console.log(`🗑️ [CRON] Found ${expiredAssets.length} expired assets. Deleting...`);

    for (const asset of expiredAssets) {
      try {
        if (asset.path) await deleteFromSupabase(asset.path);
        if (asset.thumbnailPath) await deleteFromSupabase(asset.thumbnailPath);
        if (asset.previewFrames?.length > 0) {
          await Promise.all(asset.previewFrames.map(frame => deleteFromSupabase(frame)));
        }
      } catch (err) {
        console.error(`⚠️ [CRON] Failed to delete files for asset ${asset.id}`, err);
      }
    }

    const assetIds = expiredAssets.map(a => a.id);
    await prisma.$transaction([
      prisma.assetClick.deleteMany({ where: { assetId: { in: assetIds } } }),
      prisma.assetOnCategory.deleteMany({ where: { assetId: { in: assetIds } } }),
      prisma.assetOnCollection.deleteMany({ where: { assetId: { in: assetIds } } }),
      prisma.asset.deleteMany({ where: { id: { in: assetIds } } })
    ]);

    console.log(`✅ [CRON] Permanently deleted ${expiredAssets.length} assets.`);
  } catch (error) {
    console.error('❌ [CRON] Trash cleanup error:', error);
  }
};

/* =========================================
   TASK 2: DAILY QUEST AUTO-PILOT
   ========================================= */
const launchDailyQuest = async () => {
  try {
    const now = new Date();

    // 1. Cleanup expired active quests
    await prisma.dailyQuestion.updateMany({
      where: { isActive: true, expiresAt: { lt: now } },
      data: { isActive: false }
    });

    // 2. Check if active quest exists
    const activeExists = await prisma.dailyQuestion.findFirst({ where: { isActive: true } });
    if (activeExists) {
      console.log("⚠️ [CRON] Active quest already exists. Skipping launch.");
      return;
    }

    // 3. Priority: Scheduled Quest
    let questToLaunch = await prisma.dailyQuestion.findFirst({
      where: { isActive: false, scheduledFor: { lte: now } },
      include: { options: true }
    });

    // 4. Fallback: Random from Vault
    if (!questToLaunch) {
      const whereCondition = { isActive: false, scheduledFor: null, responses: { none: {} } };
      const draftCount = await prisma.dailyQuestion.count({ where: whereCondition });

      if (draftCount > 0) {
        const skip = Math.floor(Math.random() * draftCount);
        questToLaunch = await prisma.dailyQuestion.findFirst({
          where: whereCondition,
          skip: skip,
          include: { options: true }
        });
      }
    }

    // 5. Launch
    if (questToLaunch) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.dailyQuestion.update({
        where: { id: questToLaunch.id },
        data: {
          isActive: true,
          scheduledFor: null,
          createdAt: new Date(),
          expiresAt: expiresAt
        }
      });

      console.log(`✅ [CRON] Launched Quest: "${questToLaunch.question}"`);
      await notifyIntegrations(questToLaunch.question);
    } else {
      console.log("💤 [CRON] No quests available to launch.");
    }

  } catch (error) {
    console.error("🔥 [CRON] Daily Quest Error:", error);
  }
};

const notifyIntegrations = async (questionText: string) => {
    const token = process.env.CLICKUP_API_TOKEN;
    const chatId = process.env.CLICKUP_LIST_ID;
    if (!token || !chatId) return;

    const message = 
      `__________________________________________\n` +
      `🤖 DAILY AUTO-PILOT QUEST\n` +
      `__________________________________________\n\n` +
      `QUESTION: "${questionText}"\n\n` +
      `👉 ANSWER HERE: https://dam.capy-dev.com\n` +
      `__________________________________________`;

    try {
      await axios.post(
        `https://api.clickup.com/api/v2/view/${chatId}/comment`,
        { comment_text: message, notify_all: true },
        { headers: { 'Authorization': token, 'Content-Type': 'application/json' } }
      );
    } catch (error: any) {
      console.error("❌ Notification failed:", error.message);
    }
};

/* =========================================
   TASK 3: SEASON AUTO-PILOT (New)
   ========================================= */
const checkAndEndSeason = async () => {
  try {
    const now = new Date();
    // Only run if today is the 1st of the month
    if (now.getDate() !== 1) return;

    console.log("🗓️ [CRON] It is the 1st of the month. Ending previous season...");

    // 1. Find Start Date
    const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
    const startDate = startConfig ? new Date(startConfig.value) : new Date(0);

    // 2. Find Winner
    const responses = await prisma.dailyResponse.findMany({
        where: { createdAt: { gte: startDate }, option: { isCorrect: true } },
        include: { user: true }
    });

    if (responses.length > 0) {
        const scoreMap = new Map<string, any>();
        responses.forEach(r => {
            const existing = scoreMap.get(r.userId) || { ...r.user, score: 0 };
            existing.score += 10;
            scoreMap.set(r.userId, existing);
        });
        const winner = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score)[0];

        if (winner) {
            // Archive Winner
            await prisma.seasonArchive.create({
                data: {
                    seasonName: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                    winnerId: winner.id, 
                    winnerName: winner.name, 
                    winnerAvatar: winner.avatar, 
                    winnerScore: winner.score, 
                    prizeAwarded: 5000
                }
            });
            // Award Prize
            await prisma.user.update({ where: { id: winner.id }, data: { score: { increment: 5000 } } });
            console.log(`🏆 [CRON] Season Winner: ${winner.name}`);
        }
    }

    // 3. Set Status to ENDED
    await prisma.$transaction([
        prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ENDED' }, create: { key: 'SEASON_STATUS', value: 'ENDED' } }),
        prisma.systemConfig.upsert({ where: { key: 'SEASON_END' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_END', value: new Date().toISOString() } })
    ]);
    
    console.log("✅ [CRON] Season Ended Successfully.");

  } catch (error) {
    console.error("❌ [CRON] Season End Error:", error);
  }
};