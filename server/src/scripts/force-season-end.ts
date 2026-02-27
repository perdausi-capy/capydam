import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const prisma = new PrismaClient();

// --- SEASON RECAP CLICKUP PAYLOAD ---
const buildSeasonRecapPayload = (seasonName: string, top3: any[]) => {
  const comment: any[] = [
      { type: "emoticon", emoticon: { code: "1f3c6", name: "trophy", type: "default" }, text: "🏆" },
      { text: `  ${seasonName} SEASON FINALE  `, attributes: { bold: true } },
      { text: "\n", attributes: { "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071", "advanced-banner-color": "yellow", header: 3 } },
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

  top3.forEach((user, index) => {
      if (user) {
          comment.push({ type: "emoticon", emoticon: { code: medals[index].code, name: medals[index].name, type: "default" }, text: medals[index].emoji });
          comment.push({ text: ` ${medals[index].label}: `, attributes: { bold: true } });
          comment.push({ text: `${user.name} `, attributes: {} });
          comment.push({ text: `(+${medals[index].xp})`, attributes: { code: true } });
          comment.push({ text: "\n", attributes: { blockquote: true } });
      }
  });

  comment.push(
      { text: "\n", attributes: {} },
      { type: "divider", text: "---" },
      { text: "\n", attributes: {} },
      { type: "emoticon", emoticon: { code: "1f634", name: "sleeping", type: "default" }, text: "😴" },
      { text: "  A new season will begin shortly. Rest up, units!  ", attributes: { bold: true, italic: true } },
      { type: "emoticon", emoticon: { code: "1f634", name: "sleeping", type: "default" }, text: "😴" },
      { text: "\n", attributes: { align: "center" } }
  );

  return { notify_all: true, comment: comment };
};

const forceEndSeason = async () => {
  try {
    console.log("🚀 [SCRIPT] Forcing Season End Sequence...");

    const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
    const startDate = startConfig ? new Date(startConfig.value) : new Date(0);
    const seasonName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    const responses = await prisma.dailyResponse.findMany({
        where: { createdAt: { gte: startDate }, option: { isCorrect: true } },
        include: { user: true }
    });

    let top3: any[] = [];

    if (responses.length > 0) {
        console.log(`📊 Found ${responses.length} winning responses this season. Tallying scores...`);
        const scoreMap = new Map<string, any>();
        responses.forEach(r => {
            const existing = scoreMap.get(r.userId) || { ...r.user, score: 0, streak: r.user.streak || 0 };
            existing.score += 10;
            scoreMap.set(r.userId, existing);
        });

        const sortedUsers = Array.from(scoreMap.values()).sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0);
            const dateA = new Date(a.lastDailyDate || a.updatedAt || 0).getTime();
            const dateB = new Date(b.lastDailyDate || b.updatedAt || 0).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (a.name || '').localeCompare(b.name || '');
        });

        top3 = [sortedUsers[0], sortedUsers[1], sortedUsers[2]];

        if (top3[0]) {
            console.log(`🥇 1st Place: ${top3[0].name} (${top3[0].score} XP) -> Awarding 5000 XP`);
            await prisma.seasonArchive.create({
                data: {
                    seasonName, winnerId: top3[0].id, winnerName: top3[0].name, winnerAvatar: top3[0].avatar, winnerScore: top3[0].score, prizeAwarded: 5000
                }
            });
            await prisma.user.update({ where: { id: top3[0].id }, data: { score: { increment: 5000 } } });
        }
        if (top3[1]) {
            console.log(`🥈 2nd Place: ${top3[1].name} (${top3[1].score} XP) -> Awarding 2500 XP`);
            await prisma.user.update({ where: { id: top3[1].id }, data: { score: { increment: 2500 } } });
        }
        if (top3[2]) {
            console.log(`🥉 3rd Place: ${top3[2].name} (${top3[2].score} XP) -> Awarding 1000 XP`);
            await prisma.user.update({ where: { id: top3[2].id }, data: { score: { increment: 1000 } } });
        }
    } else {
        console.log("⚠️ No winning responses found this season. Skipping XP payouts.");
    }

    console.log("🛑 Freezing Season Status in Database...");
    await prisma.$transaction([
        prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ENDED' }, create: { key: 'SEASON_STATUS', value: 'ENDED' } }),
        prisma.systemConfig.upsert({ where: { key: 'SEASON_END' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_END', value: new Date().toISOString() } })
    ]);

    // 📣 FIRE CLICKUP ANNOUNCEMENT
    const token = process.env.CLICKUP_API_TOKEN;
    const chatId = process.env.CLICKUP_LIST_ID;
    if (token && chatId && top3.length > 0) {
        console.log("📣 Firing ClickUp Announcement...");
        try {
            await axios.post(
              `https://api.clickup.com/api/v2/view/${chatId}/comment`,
              buildSeasonRecapPayload(seasonName, top3), 
              { headers: { 'Authorization': token, 'Content-Type': 'application/json' } }
            );
            console.log("✅ ClickUp Announcement Posted!");
        } catch (err: any) { 
            console.error("❌ ClickUp Finale Post Failed:", err.message); 
        }
    }
    
    console.log("\n🎉 [SUCCESS] Season Ended Successfully!");
  } catch (error) {
    console.error("\n❌ [ERROR] Season End Failed:", error);
  } finally {
      await prisma.$disconnect();
  }
};

forceEndSeason();