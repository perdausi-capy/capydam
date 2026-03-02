import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

const backfillFebruary = async () => {
  try {
    console.log("🚀 Starting February 2026 Backfill...");

    // 1. Define February Range (Feb 1 to Feb 28/March 1)
    const startDate = new Date('2026-02-01T00:00:00Z');
    const endDate = new Date('2026-03-01T06:00:00Z'); // Include through PH morning
    const seasonName = "February 2026";

    // 2. Fetch all winning responses from Feb
    const responses = await prisma.dailyResponse.findMany({
      where: { 
        createdAt: { gte: startDate, lte: endDate }, 
        option: { isCorrect: true } 
      },
      include: { user: true }
    });

    if (responses.length === 0) {
      console.log("❌ No February data found!");
      return;
    }

    // 3. Tally Scores (Same logic as your controller)
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

    const sortedUsers = Array.from(scoreMap.values()).map(u => ({
      ...u,
      timeReached: timeMap.get(u.id) || 0
    })).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.streak !== a.streak) return b.streak - a.streak;
      return a.timeReached - b.timeReached;
    });

    const top3 = sortedUsers.slice(0, 3);
    console.log(`🏆 Winners: ${top3.map(u => u.name).join(', ')}`);

    // 4. Create the Snapshot for the Modal
    const recapSnapshot = {
      seasonName: seasonName,
      leaders: sortedUsers.slice(0, 50)
    };

    // 5. Update Database
    await prisma.$transaction([
      // Save snapshot for frontend modal
      prisma.systemConfig.upsert({
        where: { key: 'LAST_SEASON_RECAP' },
        update: { value: JSON.stringify(recapSnapshot) },
        create: { key: 'LAST_SEASON_RECAP', value: JSON.stringify(recapSnapshot) }
      }),
      // Archive the season
      prisma.seasonArchive.create({
        data: {
          seasonName,
          winnerId: top3[0].id,
          winnerName: top3[0].name,
          winnerAvatar: top3[0].avatar,
          winnerScore: top3[0].score,
          prizeAwarded: 5000
        }
      })
    ]);

    console.log("✅ Database Updated. Snapshot saved.");

  } catch (error) {
    console.error("❌ Backfill Failed:", error);
  } finally {
    await prisma.$disconnect();
  }
};

backfillFebruary();