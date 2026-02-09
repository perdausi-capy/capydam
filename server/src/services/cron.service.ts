import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { deleteFromSupabase } from './storage.service'; 
import axios from 'axios'; 

const prisma = new PrismaClient();
const EXPIRATION_DAYS = 30;

export const initCronJobs = () => {
  // 1. TRASH CLEANUP: Runs every day at Midnight (00:00 UTC)
  cron.schedule('0 0 * * *', async () => {
    console.log('🕒 [CRON] Trash cleanup...');
    await cleanupExpiredAssets();
  });

  // 2. DAILY QUEST: Runs at 12:00 PM PH Time (04:00 UTC)
  // ⚡️ AGGRESSIVE MODE: Always rotates the quest at this time.
  cron.schedule('0 4 * * *', async () => {
    console.log('🕒 [CRON] 12:00 PM PH - Rotating Daily Quest...');
    await launchDailyQuest();
  });

  // 3. SEASON AUTO-END: Runs at 6:00 AM PH Time (22:00 UTC Previous Day)
  cron.schedule('0 22 * * *', async () => {
    console.log('🕒 [CRON] 6:00 AM PH - Checking Season Status...');
    await checkAndEndSeason();
  });

  console.log('✅ Cron jobs initialized (Simple Auto-Pilot Mode)');
};

// --- TRASH CLEANUP ---
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
   TASK 2: DAILY QUEST ROTATION (STRICT FRESHNESS)
   ========================================= */
const launchDailyQuest = async () => {
  try {
    console.log("🔄 [CRON] Starting Daily Rotation Sequence...");

    // 1. KILL SWITCH: Deactivate ALL currently active quests immediately
    const deactivated = await prisma.dailyQuestion.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    if (deactivated.count > 0) console.log(`   💀 Deactivated ${deactivated.count} old quest(s).`);

    // 2. FETCH RANDOM FROM VAULT
    // ✅ NEW RULE: expiresAt must be NULL. 
    // This guarantees we only pick questions that have NEVER been used.
    const whereCondition = { 
      isActive: false, 
      expiresAt: null 
    };

    const count = await prisma.dailyQuestion.count({ where: whereCondition });

    if (count === 0) {
      console.log("   ❌ VAULT IS EMPTY! No fresh questions found. (Used questions are ignored)");
      return;
    }

    // Pick a random offset
    const skip = Math.floor(Math.random() * count);
    
    const questToLaunch = await prisma.dailyQuestion.findFirst({
      where: whereCondition,
      skip: skip,
      include: { options: true }
    });

    // 3. LAUNCH SEQUENCE
    if (questToLaunch) {
      // Set expiry for 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await prisma.dailyQuestion.update({
        where: { id: questToLaunch.id },
        data: {
          isActive: true,
          scheduledFor: null,
          createdAt: new Date(), 
          expiresAt: expiresAt // This marks it as "Used" forever
        }
      });

      console.log(`   🚀 LAUNCHED: "${questToLaunch.question}"`);
      await notifyIntegrations(questToLaunch.question);
    } 

  } catch (error) {
    console.error("🔥 [CRON] Rotation Error:", error);
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
   TASK 3: SEASON AUTO-PILOT
   ========================================= */
const checkAndEndSeason = async () => {
  try {
    const now = new Date();
    // 22:00 UTC = 06:00 AM PH (+1 Day).
    const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    
    if (phTime.getDate() !== 1) return; 

    console.log("🗓️ [CRON] It is the 1st of the month (PH). Ending season...");

    const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
    const startDate = startConfig ? new Date(startConfig.value) : new Date(0);

    const responses = await prisma.dailyResponse.findMany({
        where: { createdAt: { gte: startDate }, option: { isCorrect: true } },
        include: { user: true }
    });

    if (responses.length > 0) {
        const scoreMap = new Map<string, any>();
        responses.forEach(r => {
            const existing = scoreMap.get(r.userId) || { ...r.user, score: 0, streak: r.user.streak || 0 };
            existing.score += 10;
            scoreMap.set(r.userId, existing);
        });

        const winner = Array.from(scoreMap.values()).sort((a, b) => {
             if (b.score !== a.score) return b.score - a.score;
             return b.streak - a.streak;
        })[0];

        if (winner) {
            await prisma.seasonArchive.create({
                data: {
                    seasonName: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
                    winnerId: winner.id, winnerName: winner.name, winnerAvatar: winner.avatar, winnerScore: winner.score, prizeAwarded: 5000
                }
            });
            await prisma.user.update({ where: { id: winner.id }, data: { score: { increment: 5000 } } });
        }
    }

    await prisma.$transaction([
        prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ENDED' }, create: { key: 'SEASON_STATUS', value: 'ENDED' } }),
        prisma.systemConfig.upsert({ where: { key: 'SEASON_END' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_END', value: new Date().toISOString() } })
    ]);
    
    console.log("✅ [CRON] Season Ended Successfully.");
  } catch (error) {
    console.error("❌ [CRON] Season End Error:", error);
  }
};