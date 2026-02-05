import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import axios from 'axios';
import { generateQuestWithAI, parseQuestionsWithAI } from '../services/ai.service';
import { extractTextFromFile } from '../services/file.service';

/**
 * 1. CREATE DAILY QUESTION (Admin Only)
 * Deactivates existing questions, creates a new one, and notifies ClickUp Group Chat.
 */
export const createDailyQuestion = async (req: Request, res: Response) => {
  try {
    const { question, options, expiresAt } = req.body;

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

    // C. Notify ClickUp Group Chat via View Comment API
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

    res.status(201).json(newQuestion);
  } catch (error) {
    console.error("🔥 Create Daily Question Error:", error);
    res.status(500).json({ message: "Failed to create daily question" });
  }
};

/**
 * 2. GET ACTIVE QUESTION
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

// manual kill
export const closeQuest = async (req: Request, res: Response) => {
  const { id } = req.params;
  await prisma.dailyQuestion.update({
    where: { id },
    data: { isActive: false }
  });
  res.json({ success: true });
};

/**
 * 3. SUBMIT VOTE
 * Saves the user's response and returns updated counts for the results view.
 */
export const submitVote = async (req: Request, res: Response) => {
  try {
    const { questionId, optionId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Check if correct
    const option = await prisma.questionOption.findUnique({ where: { id: optionId } });
    const isCorrect = option?.isCorrect || false;
    const points = isCorrect ? 10 : 0; // 10 Points for correct answer

    // Record Vote
    const vote = await prisma.dailyResponse.create({
      data: { userId, questionId, optionId }
    });

    // --- 🏆 SCORE & STREAK LOGIC ---
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (user) {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          score: { increment: points } // ✅ ADD POINTS
        }
      });
    }

    // Return stats + correctness
    const stats = await prisma.questionOption.findMany({
      where: { questionId },
      include: { _count: { select: { responses: true } } }
    });

    res.json({ success: true, vote, stats, isCorrect, points });
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ message: "Already voted." });
    res.status(500).json({ message: "Failed to record vote" });
  }
};

// 4. GET LEADERBOARD
export const getLeaderboard = async (req: Request, res: Response) => {
  try {
    const leaders = await prisma.user.findMany({
      orderBy: [
        { score: 'desc' },   // Highest score first
        { streak: 'desc' }   // Tie-breaker: Highest streak
      ],
      take: 10,              // Top 10
      select: {
        id: true,
        name: true,
        avatar: true,
        score: true,
        streak: true
      }
    });
    res.json(leaders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching leaderboard" });
  }
};

/**
 * 5. GET QUEST STATS (Admin Dashboard Data)
 * Returns Active Quest, User Engagement Stats, and History.
 */
export const getQuestStats = async (req: Request, res: Response) => {
  try {
    // 1. Fetch Active Quest with full details
    const activeQuest = await prisma.dailyQuestion.findFirst({
      where: { isActive: true },
      include: { 
        options: true,
        responses: {
          include: { 
            user: { select: { id: true, name: true, avatar: true } },
            option: true // Include the selected option details
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    // 2. Fetch Total User Count (For "Didn't Answer" calculation)
    const totalUsers = await prisma.user.count({
      where: { status: 'ACTIVE' } // Only count active users
    });

    // 3. Fetch History (Last 10 inactive questions)
    const history = await prisma.dailyQuestion.findMany({
      where: { isActive: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: { select: { responses: true } }
      }
    });

    // 4. ✅ Fetch Drafts (For Vault UI)
    const drafts = await prisma.dailyQuestion.findMany({
      where: { 
        isActive: false,
        responses: { none: {} } 
      },
      include: { options: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      activeQuest,
      totalUsers,
      history,
      drafts
    });
  } catch (error) {
    console.error("Stats Error:", error);
    res.status(500).json({ message: "Error fetching quest stats" });
  }
};

// 6. ✅ NEW: GENERATE QUESTION (FROM VAULT)
// This was missing in your code!
export const generateDailyQuestion = async (req: Request, res: Response) => {
  try {
    // 1. Find questions that are inactive AND have no responses (Drafts)
    const whereCondition = { 
      isActive: false,
      responses: { none: {} } 
    };

    const count = await prisma.dailyQuestion.count({ where: whereCondition });

    if (count === 0) {
      return res.status(404).json({ message: "Vault is empty! Please create or import questions manually." });
    }

    // 2. Pick random offset
    const skip = Math.floor(Math.random() * count);

    // 3. Fetch Random Draft
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

// 7. OLD AI GENERATOR (Optional - Renamed)
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

// 8. AI SMART IMPORT (File -> DB)
export const aiSmartImport = async (req: Request, res: Response) => {
  try {
    // 1. Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 2. Extract Text from PDF/Docx
    const rawText = await extractTextFromFile(req.file);

    if (!rawText || rawText.length < 10) {
      return res.status(400).json({ message: "File appears empty or unreadable." });
    }

    // 3. Send Text to AI (Existing Logic)
    const questions = await parseQuestionsWithAI(rawText);

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "AI could not find valid questions in that file." });
    }

    // 4. Save to Vault (Drafts)
    const created = await prisma.$transaction(
      questions.map((q: any) => 
        prisma.dailyQuestion.create({
          data: {
            question: q.question,
            isActive: false, // Draft
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

    res.json({ 
      message: `✨ Magic! Extracted ${created.length} quests from your file.`, 
      count: created.length 
    });

  } catch (error: any) {
    console.error("Import Error:", error);
    res.status(500).json({ message: error.message || "Server error during import" });
  }
};


// 7. DELETE SINGLE QUESTION (Used for Vault or History)
export const deleteDailyQuestion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.dailyQuestion.delete({ where: { id } });
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete item" });
  }
};

// 8. NUKE VAULT (Delete all unused drafts)
export const clearVault = async (req: Request, res: Response) => {
  try {
    // Delete questions that are inactive AND have NO responses
    const { count } = await prisma.dailyQuestion.deleteMany({
      where: { 
        isActive: false,
        responses: { none: {} } 
      }
    });
    res.json({ message: `Vault cleared! Removed ${count} items.` });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear vault" });
  }
};

// 9. NUKE HISTORY (Delete all past questions)
export const clearHistory = async (req: Request, res: Response) => {
  try {
    // Delete questions that are inactive but MIGHT have responses (History)
    // We keep the currently active one safe
    const { count } = await prisma.dailyQuestion.deleteMany({
      where: { 
        isActive: false,
        // Optional: If you want to strictly target history with votes:
        // responses: { some: {} } 
      }
    });
    res.json({ message: `History cleared! Removed ${count} items.` });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear history" });
  }
};