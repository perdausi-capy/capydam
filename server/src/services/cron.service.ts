import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { deleteFromSupabase } from './storage.service'; 
import axios from 'axios'; 

const prisma = new PrismaClient();
const EXPIRATION_DAYS = 30;

// --- PRO-TIER CLICKUP HELPER FUNCTION ---
const buildClickUpPayload = (title: string, emojiCode: string, emojiChar: string, questionText: string) => {
  return {
      notify_all: true, 
      comment: [
          // ==========================================
          // 1. BANNER HEADER
          // ==========================================
          {
              type: "emoticon",
              emoticon: { code: emojiCode, name: "icon", type: "default" },
              text: emojiChar
          },
          {
              text: `  ${title}`, // Extra space for breathing room
              attributes: { bold: true }
          },
          {
              text: "\n",
              attributes: {
                  "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071", 
                  "advanced-banner-color": "blue-strong", 
                  header: 3
              }
          },
          { text: "\n", attributes: {} },

          // ==========================================
          // 2. QUESTION HEADER
          // ==========================================
          { text: "Today's Challenge", attributes: { bold: true, underline: true } },
          { text: "\n", attributes: {} },

          // ==========================================
          // 3. THE ACTUAL QUESTION 
          // ==========================================
          // Bold, Italicized, and Indented to look like a professional blockquote
          { text: questionText, attributes: { italic: true, bold: true } },
          { text: "\n", attributes: { indent: 1 } },
          { text: "\n", attributes: {} },

          // ==========================================
          // 4. REWARDS / INFO (Bulleted List)
          // ==========================================
          {
              type: "emoticon",
              emoticon: { code: "1f48e", name: "gem", type: "default" }, // 💎
              text: "💎"
          },
          { text: " Reward: ", attributes: { bold: true } },
          { text: "+10 XP", attributes: { code: true } }, // Uses code block to make the XP pop!
          { text: " for the correct answer.", attributes: {} },
          { text: "\n", attributes: { list: { list: "bullet" } } }, // Formats as Bullet 1

          {
              type: "emoticon",
              emoticon: { code: "1f525", name: "fire", type: "default" }, // 🔥
              text: "🔥"
          },
          { text: " Streak: ", attributes: { bold: true } },
          { text: "Keep your consecutive answer streak alive!", attributes: {} },
          { text: "\n", attributes: { list: { list: "bullet" } } }, // Formats as Bullet 2
          
          { text: "\n", attributes: {} },

          // ==========================================
          // 5. DIVIDER
          // ==========================================
          { type: "divider", text: "---" },
          { text: "\n", attributes: {} },

          // ==========================================
          // 6. CALL TO ACTION (CENTERED)
          // ==========================================
          {
              type: "emoticon",
              emoticon: { code: "1f680", name: "rocket", type: "default" }, // 🚀
              text: "🚀"
          },
          { text: "  SUBMIT YOUR ANSWER HERE  ", attributes: { bold: true, link: "https://dam.capy-dev.com" } },
          {
              type: "emoticon",
              emoticon: { code: "1f680", name: "rocket", type: "default" }, // 🚀
              text: "🚀"
          },
          { text: "\n", attributes: { align: "center" } } // Centers the entire line perfectly
      ]
  };
};


// --- SEASON RECAP CLICKUP PAYLOAD ---
const buildSeasonRecapPayload = (seasonName: string, top3: any[]) => {
  const comment: any[] = [
      // ==========================================
      // 1. BANNER HEADER
      // ==========================================
      {
          type: "emoticon",
          emoticon: { code: "1f3c6", name: "trophy", type: "default" },
          text: "🏆"
      },
      {
          text: `  ${seasonName} SEASON FINALE  `, 
          attributes: { bold: true }
      },
      {
          text: "\n",
          attributes: {
              "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071", 
              "advanced-banner-color": "yellow", 
              header: 3
          }
      },
      { text: "\n", attributes: {} },
      { text: "The dust has settled. The scores are tallied. Here are your Champions:", attributes: { italic: true } },
      { text: "\n", attributes: {} },
      { text: "\n", attributes: {} }
  ];

  const medals = [
      { emoji: "🥇", code: "1f947", name: "1st_place_medal", label: "1st Place", xp: "5000 XP" },
      { emoji: "🥈", code: "1f948", name: "2nd_place_medal", label: "2nd Place", xp: "2500 XP" },
      { emoji: "🥉", code: "1f949", name: "3rd_place_medal", label: "3rd Place", xp: "1000 XP" }
  ];

  // ==========================================
  // 2. DYNAMIC WINNERS LIST
  // ==========================================
  top3.forEach((user, index) => {
      if (user) {
          comment.push({ 
              type: "emoticon", 
              emoticon: { code: medals[index].code, name: medals[index].name, type: "default" }, 
              text: medals[index].emoji 
          });
          comment.push({ text: ` ${medals[index].label}: `, attributes: { bold: true } });
          comment.push({ text: `${user.name} `, attributes: {} });
          comment.push({ text: `(+${medals[index].xp})`, attributes: { code: true } });
          comment.push({ text: "\n", attributes: { blockquote: true } });
      }
  });

  // ==========================================
  // 3. FOOTER & CALL TO ACTION
  // ==========================================
  comment.push(
      { text: "\n", attributes: {} },
      { type: "divider", text: "---" },
      { text: "\n", attributes: {} },
      { type: "emoticon", emoticon: { code: "1f634", name: "sleeping", type: "default" }, text: "😴" },
      { text: "  A new season will begin shortly. Rest up, units!  ", attributes: { bold: true, italic: true } },
      { type: "emoticon", emoticon: { code: "1f634", name: "sleeping", type: "default" }, text: "😴" },
      { text: "\n", attributes: { align: "center" } }
  );

  return {
      notify_all: true, 
      comment: comment
  };
};



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
/* =========================================
   TASK 2: DAILY QUEST ROTATION (STRICT FRESHNESS)
   ========================================= */
   const launchDailyQuest = async () => {
    try {
      console.log("🔄 [CRON] Starting Daily Rotation Sequence...");
  
      // 🚨 GATEKEEPER: Check if the season is actually running!
      const seasonStatus = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_STATUS' } });
      if (seasonStatus?.value === 'ENDED') {
          console.log("⏸️ [CRON] Season is currently ENDED. Skipping daily quest rotation.");
          return; // Abort the entire function!
      }
  
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

// ---------------------------------------------------------
// YOUR UPDATED NOTIFY FUNCTION
// ---------------------------------------------------------

const notifyIntegrations = async (questionText: string) => {
  const token = process.env.CLICKUP_API_TOKEN;
  const chatId = process.env.CLICKUP_LIST_ID;
  if (!token || !chatId) return;

  // ✅ Generate the Professional Rich-Text Payload
  const clickUpPayload = buildClickUpPayload(
      "DAILY QUEST NA THIS", 
      "1f916", // 🤖 unicode
      "🤖", 
      questionText
  );

  try {
    await axios.post(
      `https://api.clickup.com/api/v2/view/${chatId}/comment`,
      clickUpPayload, // ✅ Pass the JSON object directly (it already includes notify_all)
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
        
        // 🚨 CRITICAL FIX: Named based on when the season STARTED, not the current date.
        const seasonName = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    
        const responses = await prisma.dailyResponse.findMany({
            where: { createdAt: { gte: startDate }, option: { isCorrect: true } },
            include: { user: true }
        });
    
        let top3: any[] = [];
    
        if (responses.length > 0) {
            const scoreMap = new Map<string, any>();
            const timeMap = new Map<string, number>(); // ✅ TRACKS EXACT MILLISECOND
            
            responses.forEach(r => {
                const existing = scoreMap.get(r.userId) || { ...r.user, score: 0, streak: r.user.streak || 0 };
                existing.score += 10;
                scoreMap.set(r.userId, existing);

                const rTime = new Date(r.createdAt).getTime();
                const currentLastTime = timeMap.get(r.userId) || 0;
                if (rTime > currentLastTime) timeMap.set(r.userId, rTime);
            });

            // ✅ GET ALL SORTED USERS
            const sortedUsers = Array.from(scoreMap.values()).map(u => ({
                ...u,
                timeReached: timeMap.get(u.id) || 0
            })).sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0);
                if (a.timeReached !== b.timeReached) return a.timeReached - b.timeReached;
                return (a.name || '').localeCompare(b.name || '');
            });

            const first = sortedUsers[0];
            const second = sortedUsers[1];
            const third = sortedUsers[2];
            
            // 🚨 CRITICAL FIX: Populate the top3 array so rewards and announcements trigger!
            top3 = [first, second, third].filter(Boolean);
    
            if (top3[0]) {
                await prisma.seasonArchive.create({
                    data: {
                        seasonName, winnerId: top3[0].id, winnerName: top3[0].name, winnerAvatar: top3[0].avatar, winnerScore: top3[0].score, prizeAwarded: 5000
                    }
                });
                await prisma.user.update({ where: { id: top3[0].id }, data: { score: { increment: 5000 } } });
            }
            if (top3[1]) await prisma.user.update({ where: { id: top3[1].id }, data: { score: { increment: 2500 } } });
            if (top3[2]) await prisma.user.update({ where: { id: top3[2].id }, data: { score: { increment: 1000 } } });
        }
    
        // 🛑 Freezing Season Status (Streaks remain frozen until the new season starts)
        await prisma.$transaction([
            prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ENDED' }, create: { key: 'SEASON_STATUS', value: 'ENDED' } }),
            prisma.systemConfig.upsert({ where: { key: 'SEASON_END' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_END', value: new Date().toISOString() } })
        ]);
    
        // 📣 FIRE CLICKUP ANNOUNCEMENT
        const token = process.env.CLICKUP_API_TOKEN;
        const chatId = process.env.CLICKUP_LIST_ID;
        if (token && chatId && top3.length > 0) {
            try {
                await axios.post(
                    `https://api.clickup.com/api/v2/view/${chatId}/comment`,
                    buildSeasonRecapPayload(seasonName, top3), 
                    { headers: { 'Authorization': token, 'Content-Type': 'application/json' } }
                );
            } catch (err: any) { console.error("ClickUp Finale Post Failed:", err.message); }
        }
        
        console.log("✅ [CRON] Season Ended Successfully. Top 3 rewarded and announced.");
    } catch (error) {
        console.error("❌ [CRON] Season End Error:", error);
    }
};