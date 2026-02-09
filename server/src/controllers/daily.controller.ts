import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import axios from 'axios';
import { generateQuestWithAI, parseQuestionsWithAI } from '../services/ai.service';
import { extractTextFromFile } from '../services/file.service';

/* =========================================
   CORE GAME LOOP (Public)
   ========================================= */

// 1. GET ACTIVE QUESTION
export const getActiveQuestion = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; 
    const now = new Date();

    const question = await prisma.dailyQuestion.findFirst({
      where: { 
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } } 
        ]
      },
      include: { 
        options: true,
        responses: {
          where: { userId },
          include: { user: { select: { name: true, avatar: true } } } 
        }
      }
    });

    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Error fetching active question" });
  }
};

// 2. SUBMIT VOTE
export const submitVote = async (req: Request, res: Response) => {
  try {
    const { questionId, optionId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const option = await prisma.questionOption.findUnique({ where: { id: optionId } });
    const isCorrect = option?.isCorrect || false;
    const points = isCorrect ? 10 : 0; 

    const vote = await prisma.dailyResponse.create({
      data: { userId, questionId, optionId }
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (user) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let newStreak = 1; 

      if (user.lastDailyDate) {
        const lastDate = new Date(user.lastDailyDate);
        const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        
        const diffTime = Math.abs(today.getTime() - lastMidnight.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
          newStreak = (user.streak || 0) + 1;
        } else if (diffDays === 0) {
          newStreak = user.streak || 1; 
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: { 
          score: { increment: points },
          streak: newStreak,
          lastDailyDate: now 
        }
      });
    }

    const stats = await prisma.questionOption.findMany({
      where: { questionId },
      include: { _count: { select: { responses: true } } }
    });

    res.json({ success: true, vote, stats, isCorrect, points });

  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: "You have already voted on this quest." });
    }
    console.error("Submit Vote Error:", error);
    res.status(500).json({ message: "Failed to record vote" });
  }
};

/* =========================================
   ADMIN DASHBOARD & CREATE (Protected)
   ========================================= */

// 3. CREATE DAILY QUESTION
export const createDailyQuestion = async (req: Request, res: Response) => {
  try {
    const { question, options, expiresAt, scheduledFor } = req.body;

    if (!scheduledFor) {
        await prisma.dailyQuestion.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        });

        const newQuestion = await prisma.dailyQuestion.create({
          data: {
            question,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            isActive: true,
            options: {
              create: options.map((opt: any) => ({
                text: opt.text,
                isCorrect: opt.isCorrect || false
              }))
            }
          },
          include: { options: true }
        });

        const token = process.env.CLICKUP_API_TOKEN;
        const chatId = process.env.CLICKUP_LIST_ID; 

        if (token && chatId) {
          const message = 
            `__________________________________________\n` +
            `📢 CAPYDAM QUESTION OF THE DAY\n` +
            `__________________________________________\n\n` +
            `QUESTION: "${question}"\n\n` +
            `👉 ANSWER HERE: https://dam.capy-dev.com\n` +
            `__________________________________________`;
        
          try {
            await axios.post(
              `https://api.clickup.com/api/v2/view/${chatId}/comment`,
              { comment_text: message, notify_all: true },
              { headers: { 'Authorization': token, 'Content-Type': 'application/json' } }
            );
          } catch (error: any) {
            console.error("❌ ClickUp API Error:", error.message);
          }
        }

        return res.status(201).json(newQuestion);
    }
    else {
        const targetDate = new Date(scheduledFor);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existingSchedule = await prisma.dailyQuestion.findFirst({
            where: {
                isActive: false,
                scheduledFor: { gte: startOfDay, lte: endOfDay }
            }
        });

        if (existingSchedule) {
            return res.status(400).json({ message: "This day is already scheduled." });
        }

        const newScheduled = await prisma.dailyQuestion.create({
          data: {
            question,
            isActive: false, 
            scheduledFor: targetDate, 
            options: {
              create: options.map((opt: any) => ({
                text: opt.text,
                isCorrect: opt.isCorrect || false
              }))
            }
          },
          include: { options: true }
        });
        
        return res.status(201).json(newScheduled);
    }

  } catch (error) {
    console.error("🔥 Create Daily Question Error:", error);
    res.status(500).json({ message: "Failed to create daily question" });
  }
};

// 4. MANUAL KILL
export const closeQuest = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.dailyQuestion.update({
    where: { id },
    data: { isActive: false }
  });
  res.json({ success: true });
};

// 5. GET QUEST STATS
export const getQuestStats = async (req: Request, res: Response) => {
  try {
    const activeQuest = await prisma.dailyQuestion.findFirst({
      where: { isActive: true },
      include: { 
        options: true,
        responses: {
          include: { 
            user: { select: { id: true, name: true, avatar: true } },
            option: true 
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const totalUsers = await prisma.user.count({ where: { status: 'ACTIVE' } });

    const history = await prisma.dailyQuestion.findMany({
      where: { isActive: false, scheduledFor: null }, 
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { _count: { select: { responses: true } } }
    });

    const drafts = await prisma.dailyQuestion.findMany({
      where: { isActive: false, responses: { none: {} }, scheduledFor: null },
      include: { options: true },
      orderBy: { createdAt: 'desc' }
    });

    const scheduled = await prisma.dailyQuestion.findMany({
      where: { 
        isActive: false, 
        scheduledFor: { not: null } 
      },
      orderBy: { scheduledFor: 'asc' }, 
      include: { options: true }
    });

    res.json({ activeQuest, totalUsers, history, drafts, scheduled });
  } catch (error) {
    res.status(500).json({ message: "Error fetching quest stats" });
  }
};

/* =========================================
   SEASON & LEADERBOARD MANAGEMENT
   ========================================= */

// 6. GET LEADERBOARD
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.id;
    const { range } = req.query; 

    const statusConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_STATUS' } });
    const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
    const endConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_END' } });

    const status = statusConfig?.value || 'ACTIVE'; 
    const seasonStart = startConfig ? new Date(startConfig.value) : new Date(0);
    const seasonEnd = endConfig ? new Date(endConfig.value) : new Date();

    let rankedUsers: any[] = [];
    
    // --- SEASON LOGIC ---
    if (range === 'monthly') {
        const endDateFilter = status === 'ENDED' ? seasonEnd : new Date();

        const seasonResponses = await prisma.dailyResponse.findMany({
            where: {
                createdAt: { gte: seasonStart, lte: endDateFilter },
                option: { isCorrect: true }
            },
            include: { user: { select: { id: true, name: true, avatar: true, streak: true } } }
        });

        const scoreMap = new Map<string, any>();
        seasonResponses.forEach(r => {
            const existing = scoreMap.get(r.userId) || { ...r.user, score: 0 };
            existing.score += 10;
            scoreMap.set(r.userId, existing);
        });
        rankedUsers = Array.from(scoreMap.values());

    } else {
        // ALL TIME
        rankedUsers = await prisma.user.findMany({
            where: { status: 'ACTIVE', score: { gt: 0 } },
            select: { id: true, name: true, avatar: true, streak: true, score: true }
        });
    }

    // ✅ FIX: Sort by Score > Streak
    rankedUsers.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.streak - a.streak;
    });

    // ✅ FIX: Top 50 & Unranked
    const topList = rankedUsers.slice(0, 50).map((u, i) => ({ 
        ...u, 
        rank: u.score > 0 ? i + 1 : 0 // 0 = Unranked
    }));
    
    // Find Current User
    let currentUserStat = topList.find(u => u.id === currentUserId);
    if (!currentUserStat && currentUserId) {
        const userDetails = await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true, name: true, avatar: true, streak: true, score: true } });
        if(userDetails) currentUserStat = { ...userDetails, score: 0, rank: 0 }; 
    }

    res.json({
        leaders: topList,
        user: currentUserStat,
        status: status 
    });

  } catch (error) {
    res.status(500).json({ message: "Leaderboard error" });
  }
};

// 7. START SEASON
export const startSeason = async (req: Request, res: Response) => {
    try {
        await prisma.$transaction([
            prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ACTIVE' }, create: { key: 'SEASON_STATUS', value: 'ACTIVE' } }),
            prisma.systemConfig.upsert({ where: { key: 'SEASON_START' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_START', value: new Date().toISOString() } }),
            prisma.systemConfig.deleteMany({ where: { key: 'SEASON_END' } }) 
        ]);
        res.json({ message: "🚀 Season Started! Score tracking is live." });
    } catch (error) {
        res.status(500).json({ message: "Failed to start" });
    }
};

// 8. END SEASON
export const endSeason = async (req: Request, res: Response) => {
    try {
        const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
        const startDate = startConfig ? new Date(startConfig.value) : new Date(0);

        const responses = await prisma.dailyResponse.findMany({
            where: { createdAt: { gte: startDate }, option: { isCorrect: true } },
            include: { user: true }
        });

        if (responses.length > 0) {
            const scoreMap = new Map<string, any>();
            responses.forEach(r => {
                const existing = scoreMap.get(r.userId) || { ...r.user, score: 0 };
                existing.score += 10;
                existing.streak = r.user.streak || 0;
                scoreMap.set(r.userId, existing);
            });
            
            // ✅ FIX: Tie Breaker Logic (Score > Streak)
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

        res.json({ message: "🛑 Season Ended. Results are frozen." });
    } catch (error) {
        res.status(500).json({ message: "Failed to end" });
    }
};

// 9. FACTORY RESET
export const resetAllTimeStats = async (req: Request, res: Response) => {
  try {
    await prisma.dailyResponse.deleteMany({});
    await prisma.user.updateMany({
      data: { score: 0, streak: 0, lastDailyDate: null }
    });
    await prisma.systemConfig.upsert({
        where: { key: 'SEASON_START' },
        update: { value: new Date().toISOString() },
        create: { key: 'SEASON_START', value: new Date().toISOString() }
    });
    res.json({ message: "⚠️ GLOBAL RESET COMPLETE. All scores and history wiped." });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset all-time stats" });
  }
};

/* =========================================
   AI, VAULT & TOOLS
   ========================================= */

// 10. GENERATE FROM VAULT
export const generateDailyQuestion = async (req: Request, res: Response) => {
  try {
    const whereCondition = { isActive: false, responses: { none: {} }, scheduledFor: null };
    const count = await prisma.dailyQuestion.count({ where: whereCondition });
    if (count === 0) return res.status(404).json({ message: "Vault is empty!" });

    const skip = Math.floor(Math.random() * count);
    const randomQuestion = await prisma.dailyQuestion.findFirst({
      where: whereCondition,
      include: { options: true },
      skip: skip
    });

    res.json(randomQuestion);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch from Vault" });
  }
};

// 11. AI GENERATE (Optional)
export const generateQuest = async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;
    const aiData = await generateQuestWithAI(topic);
    if (!aiData) return res.status(500).json({ message: "AI failed to generate quest" });
    res.json(aiData);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// 12. AI IMPORT
export const aiSmartImport = async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const rawText = await extractTextFromFile(req.file);
    if (!rawText || rawText.length < 10) return res.status(400).json({ message: "File appears empty or unreadable." });

    const questions = await parseQuestionsWithAI(rawText);
    if (!questions || !Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: "AI could not find valid questions." });

    const created = await prisma.$transaction(
      questions.map((q: any) => 
        prisma.dailyQuestion.create({
          data: {
            question: q.question,
            isActive: false, 
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            options: {
              create: q.options.map((opt: any) => ({
                text: opt.text,
                isCorrect: opt.isCorrect || false
              }))
            }
          }
        })
      )
    );

    res.json({ message: `✨ Magic! Extracted ${created.length} quests.`, count: created.length });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Server error during import" });
  }
};

// 13. UNSCHEDULE
export const unscheduleQuest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dailyQuestion.update({
      where: { id },
      data: { scheduledFor: null } 
    });
    res.json({ message: "Quest unscheduled and moved to Vault." });
  } catch (error) {
    res.status(500).json({ message: "Failed to unschedule quest." });
  }
};

// 14. DELETE
export const deleteDailyQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dailyQuestion.delete({ where: { id } });
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete item" });
  }
};

// 15. CLEAR VAULT
export const clearVault = async (req: Request, res: Response) => {
  try {
    const { count } = await prisma.dailyQuestion.deleteMany({
      where: { isActive: false, responses: { none: {} } }
    });
    res.json({ message: `Vault cleared! Removed ${count} items.` });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear vault" });
  }
};

// 16. CLEAR HISTORY
export const clearHistory = async (req: Request, res: Response) => {
  try {
    const { count } = await prisma.dailyQuestion.deleteMany({
      where: { isActive: false }
    });
    res.json({ message: `History cleared! Removed ${count} items.` });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear history" });
  }
};