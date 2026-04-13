import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMarchRecap() {
  console.log("🚀 Starting March 2026 Recap Fix...");

  try {
    // 1. Define March Range (March 1 to April 1)
    const startDate = new Date('2026-03-01T00:00:00Z');
    const endDate = new Date('2026-04-01T06:00:00Z'); 
    const seasonName = "March 2026";

    // 2. Fetch all winning responses from March
    const responses = await prisma.dailyResponse.findMany({
      where: { 
        createdAt: { gte: startDate, lte: endDate }, 
        option: { isCorrect: true } 
      },
      include: { user: true }
    });

    if (responses.length === 0) {
      console.log("❌ No March data found! Check the dates.");
      return;
    }

    console.log(`📊 Found ${responses.length} correct answers in March. Tallying...`);

    // 3. Tally Scores exactly like the cron job
    const scoreMap = new Map<string, any>();
    const timeMap = new Map<string, number>();

    responses.forEach(r => {
      const existing = scoreMap.get(r.userId) || { ...r.user, score: 0, streak: r.user.streak || 0 };
      existing.score += 10;
      scoreMap.set(r.userId, existing);

      const rTime = new Date(r.createdAt).getTime();
      const currentLastTime = timeMap.get(r.userId) || 0;
      if (rTime > currentLastTime) timeMap.set(r.userId, rTime);
    });

    // 4. Sort Leaders (Score > Streak > Exact Time)
    const sortedUsers = Array.from(scoreMap.values()).map(u => ({
      ...u,
      timeReached: timeMap.get(u.id) || 0
    })).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.streak || 0) !== (a.streak || 0)) return (b.streak || 0) - (a.streak || 0);
      if (a.timeReached !== b.timeReached) return a.timeReached - b.timeReached;
      return (a.name || '').localeCompare(b.name || '');
    });

    const top50 = sortedUsers.slice(0, 50);
    console.log(`🏆 #1 Champion is: ${top50[0]?.name || 'Unknown'} with ${top50[0]?.score || 0} XP!`);

    // 5. Create the Snapshot
    const recapSnapshot = {
      seasonName: seasonName,
      leaders: top50
    };

    // 6. Force Update the SystemConfig table
    await prisma.systemConfig.upsert({
      where: { key: 'LAST_SEASON_RECAP' },
      update: { value: JSON.stringify(recapSnapshot) },
      create: { key: 'LAST_SEASON_RECAP', value: JSON.stringify(recapSnapshot) }
    });

    console.log("✅ BOOM! SystemConfig updated. The modal is now loaded with the real March 2026 data.");

  } catch (error) {
    console.error("❌ Error fixing recap:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMarchRecap();
