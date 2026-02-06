import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import axios from 'axios';
import { generateQuestWithAI, parseQuestionsWithAI } from '../services/ai.service';
import { extractTextFromFile } from '../services/file.service';

/* =========================================
   CORE GAME LOOP (Public)
   ========================================= */

/**
 * 1. GET ACTIVE QUESTION
 * Fetches current question and checks if the requesting user has already voted.
 */
export const getActiveQuestion = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; 
    const now = new Date();

    const question = await prisma.dailyQuestion.findFirst({
      where: { 
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } } // Must be Greater Than 'now'
        ]
      },
      include: { 
        options: true,
        responses: {
          where: { userId },
          include: { user: { select: { name: true, avatar: true } } } // Include for Admin View
        }
      }
    });

    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Error fetching active question" });
  }
};

/**
 * 2. SUBMIT VOTE
 * Saves the user's response, calculates streaks, and updates score.
 */
export const submitVote = async (req: Request, res: Response) => {
  try {
    const { questionId, optionId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // 1. Check if correct
    const option = await prisma.questionOption.findUnique({ where: { id: optionId } });
    const isCorrect = option?.isCorrect || false;
    const points = isCorrect ? 10 : 0; // 10 Points for correct answer

    // 2. Record Vote (Will throw P2002 if already voted today for this specific question)
    const vote = await prisma.dailyResponse.create({
      data: { userId, questionId, optionId }
    });

    // 3. --- 🏆 SCORE & STREAK LOGIC ---
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (user) {
      const now = new Date();
      // Normalize dates to midnight to ignore time differences
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let newStreak = 1; // Default reset

      if (user.lastDailyDate) {
        const lastDate = new Date(user.lastDailyDate);
        const lastMidnight = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
        
        // Calculate difference in days
        const diffTime = Math.abs(today.getTime() - lastMidnight.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
          // Voted yesterday -> Streak Continues 🔥
          newStreak = (user.streak || 0) + 1;
        } else if (diffDays === 0) {
          // Voted today already (Shouldn't happen due to DB unique constraint, but safe fallback)
          newStreak = user.streak || 1; 
        }
        // If diffDays > 1, streak remains 1 (Reset)
      }

      await prisma.user.update({
        where: { id: userId },
        data: { 
          score: { increment: points },
          streak: newStreak,
          lastDailyDate: now // Update last activity to now
        }
      });
    }

    // 4. Return stats + correctness
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

/**
 * 3. CREATE DAILY QUESTION (Admin Only)
 * Handles both IMMEDIATE launches and FUTURE scheduling.
 */
export const createDailyQuestion = async (req: Request, res: Response) => {
  try {
    const { question, options, expiresAt, scheduledFor } = req.body;

    // --- CASE 1: IMMEDIATE LAUNCH (Standard) ---
    if (!scheduledFor) {
        // A. Deactivate all currently active questions
        await prisma.dailyQuestion.updateMany({
          where: { isActive: true },
          data: { isActive: false }
        });

        // B. Create new question and associated options
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

        // C. Notify ClickUp Group Chat
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
              { 
                comment_text: message, 
                notify_all: true 
              },
              { 
                headers: { 
                  'Authorization': token, 
                  'Content-Type': 'application/json' 
                } 
              }
            );
            console.log("✅ Clean system notification sent.");
          } catch (error: any) {
            console.error("❌ ClickUp API Error:", error.response?.data || error.message);
          }
        }

        return res.status(201).json(newQuestion);
    }

    // --- CASE 2: SCHEDULED FOR LATER (New) ---
    else {
        // 🛑 CONFLICT CHECK: Prevent double booking the same day
        const targetDate = new Date(scheduledFor);
        
        // Calculate Start (00:00:00) and End (23:59:59) of that specific day
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existingSchedule = await prisma.dailyQuestion.findFirst({
            where: {
                isActive: false,
                scheduledFor: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        if (existingSchedule) {
            return res.status(400).json({ message: "This day is already scheduled." });
        }

        // Proceed to Schedule
        const newScheduled = await prisma.dailyQuestion.create({
          data: {
            question,
            isActive: false, // Stays inactive until Cron picks it up
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
        
        console.log(`⏰ Quest scheduled for ${scheduledFor}`);
        return res.status(201).json(newScheduled);
    }

  } catch (error) {
    console.error("🔥 Create Daily Question Error:", error);
    res.status(500).json({ message: "Failed to create daily question" });
  }
};

// 4. MANUAL KILL (Stop current quest)
export const closeQuest = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.dailyQuestion.update({
    where: { id },
    data: { isActive: false }
  });
  res.json({ success: true });
};

/**
 * 5. GET QUEST STATS (Admin Dashboard Data)
 * Returns Active Quest, User Engagement Stats, and History.
 */
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
      where: { isActive: false, scheduledFor: null }, // ✅ Exclude scheduled
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { _count: { select: { responses: true } } }
    });

    const drafts = await prisma.dailyQuestion.findMany({
      where: { isActive: false, responses: { none: {} }, scheduledFor: null }, // ✅ Exclude scheduled
      include: { options: true },
      orderBy: { createdAt: 'desc' }
    });

    // ✅ NEW: Fetch Scheduled Queue
    const scheduled = await prisma.dailyQuestion.findMany({
      where: { 
        isActive: false, 
        scheduledFor: { not: null } 
      },
      orderBy: { scheduledFor: 'asc' }, // Soonest first
      include: { options: true }
    });

    res.json({ activeQuest, totalUsers, history, drafts, scheduled });
  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({ message: "Error fetching quest stats" });
  }
};

/* =========================================
   SEASON & LEADERBOARD MANAGEMENT
   ========================================= */

// 6. GET LEADERBOARD (Dynamic Season Support)
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const currentUserId = (req as any).user?.id;
    const { range } = req.query; // 'monthly' (Season) or 'all'

    // 1. Get Season Config
    const statusConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_STATUS' } });
    const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
    const endConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_END' } });

    const status = statusConfig?.value || 'ACTIVE'; // Default to ACTIVE
    const seasonStart = startConfig ? new Date(startConfig.value) : new Date(0);
    const seasonEnd = endConfig ? new Date(endConfig.value) : new Date(); // If ended, use end date. If active, use Now.

    let rankedUsers: any[] = [];
    
    // --- SEASON LOGIC ---
    if (range === 'monthly') {
        // If Season is ENDED, we show the static results (History)
        // If Season is ACTIVE, we show live results
        const endDateFilter = status === 'ENDED' ? seasonEnd : new Date();

        const seasonResponses = await prisma.dailyResponse.findMany({
            where: {
                createdAt: { 
                    gte: seasonStart,
                    lte: endDateFilter 
                },
                option: { isCorrect: true }
            },
            include: { user: { select: { id: true, name: true, avatar: true, streak: true } } }
        });

        // Calculate Scores
        const scoreMap = new Map<string, any>();
        seasonResponses.forEach(r => {
            const existing = scoreMap.get(r.userId) || { ...r.user, score: 0 };
            existing.score += 10;
            scoreMap.set(r.userId, existing);
        });
        rankedUsers = Array.from(scoreMap.values());

    } else {
        // ALL TIME (Unchanged)
        rankedUsers = await prisma.user.findMany({
            where: { status: 'ACTIVE', score: { gt: 0 } },
            select: { id: true, name: true, avatar: true, streak: true, score: true }
        });
    }

    // Sort & Rank
    rankedUsers.sort((a, b) => b.score - a.score || b.streak - a.streak);
    const top10 = rankedUsers.slice(0, 10).map((u, i) => ({ ...u, rank: i + 1 }));
    
    // Find Current User
    let currentUserStat = top10.find(u => u.id === currentUserId);
    if (!currentUserStat && currentUserId) {
        const userDetails = await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true, name: true, avatar: true, streak: true, score: true } });
        if(userDetails) currentUserStat = { ...userDetails, score: 0, rank: 999 }; 
    }

    res.json({
        leaders: top10,
        user: currentUserStat,
        status: status // ✅ Send status to frontend
    });

  } catch (error) {
    res.status(500).json({ message: "Leaderboard error" });
  }
};

// 7. START SEASON (Action)
export const startSeason = async (req: Request, res: Response) => {
    try {
        await prisma.$transaction([
            // Set Status to ACTIVE
            prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ACTIVE' }, create: { key: 'SEASON_STATUS', value: 'ACTIVE' } }),
            // Set Start Date to NOW
            prisma.systemConfig.upsert({ where: { key: 'SEASON_START' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_START', value: new Date().toISOString() } }),
            // Clear End Date
            prisma.systemConfig.deleteMany({ where: { key: 'SEASON_END' } }) 
        ]);
        res.json({ message: "🚀 Season Started! Score tracking is live." });
    } catch (error) {
        res.status(500).json({ message: "Failed to start" });
    }
};

// 8. END SEASON (Action)
export const endSeason = async (req: Request, res: Response) => {
    try {
        // 1. Find Start Date
        const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
        const startDate = startConfig ? new Date(startConfig.value) : new Date(0);

        // 2. Find Winner
        const responses = await prisma.dailyResponse.findMany({
            where: { createdAt: { gte: startDate }, option: { isCorrect: true } },
            include: { user: true }
        });

        // 3. Process Winner (if any)
        if (responses.length > 0) {
            const scoreMap = new Map<string, any>();
            responses.forEach(r => {
                const existing = scoreMap.get(r.userId) || { ...r.user, score: 0 };
                existing.score += 10;
                scoreMap.set(r.userId, existing);
            });
            const winner = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score)[0];

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

        // 4. Set Status to ENDED
        await prisma.$transaction([
            prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ENDED' }, create: { key: 'SEASON_STATUS', value: 'ENDED' } }),
            prisma.systemConfig.upsert({ where: { key: 'SEASON_END' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_END', value: new Date().toISOString() } })
        ]);

        res.json({ message: "🛑 Season Ended. Results are frozen." });
    } catch (error) {
        res.status(500).json({ message: "Failed to end" });
    }
};

// 9. FACTORY RESET (Wipe All Gamification Data)
export const resetAllTimeStats = async (req: Request, res: Response) => {
  try {
    // 1. Wipe all vote history (Battle Logs)
    await prisma.dailyResponse.deleteMany({});

    // 2. Reset every user's score and streak to 0
    await prisma.user.updateMany({
      data: {
        score: 0,
        streak: 0,
        lastDailyDate: null // Reset streak tracking date
      }
    });

    // 3. Reset the "Season Start" config too, just to be clean
    await prisma.systemConfig.upsert({
        where: { key: 'SEASON_START' },
        update: { value: new Date().toISOString() },
        create: { key: 'SEASON_START', value: new Date().toISOString() }
    });

    res.json({ message: "⚠️ GLOBAL RESET COMPLETE. All scores and history wiped." });
  } catch (error) {
    console.error("Reset Error:", error);
    res.status(500).json({ message: "Failed to reset all-time stats" });
  }
};

/* =========================================
   AI, VAULT & TOOLS
   ========================================= */

// 10. GENERATE QUESTION (FROM VAULT)
export const generateDailyQuestion = async (req: Request, res: Response) => {
  try {
    const whereCondition = { 
      isActive: false,
      responses: { none: {} },
      scheduledFor: null 
    };

    const count = await prisma.dailyQuestion.count({ where: whereCondition });

    if (count === 0) {
      return res.status(404).json({ message: "Vault is empty! No unscheduled drafts found." });
    }

    const skip = Math.floor(Math.random() * count);

    const randomQuestion = await prisma.dailyQuestion.findFirst({
      where: whereCondition,
      include: { options: true },
      skip: skip
    });

    res.json(randomQuestion);

  } catch (error) {
    console.error("Vault Gen Error:", error);
    res.status(500).json({ message: "Failed to fetch from Vault" });
  }
};

// 11. OLD AI GENERATOR (Optional)
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

// 12. AI SMART IMPORT (File -> DB)
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
    console.error("Import Error:", error);
    res.status(500).json({ message: error.message || "Server error during import" });
  }
};

// 13. UNSCHEDULE QUEST (Move back to Vault)
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

// 14. DELETE SINGLE QUESTION (Vault/History)
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