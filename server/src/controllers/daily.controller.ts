import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import axios from 'axios';


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
    const chatId = process.env.CLICKUP_LIST_ID; // Should contain: 2kzkdb7b-41738

    // src/controllers/daily.controller.ts

    if (token && chatId) {
      // We use clean ASCII lines to create a "box" effect that works in plain text
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

    // ✅ ADD THIS: Explicit validation check
    if (!questionId || !optionId) {
      return res.status(400).json({ message: "Missing questionId or optionId" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // A. Record the vote
    const vote = await prisma.dailyResponse.create({
      data: { userId, questionId, optionId }
    });

    // B. Fetch updated stats for all options to show results immediately
    const stats = await prisma.questionOption.findMany({
      where: { questionId },
      include: {
        _count: {
          select: { responses: true }
        }
      }
    });

    res.json({ success: true, vote, stats });
  } catch (error: any) {
    // P2002 is Prisma's code for unique constraint violation (user already voted)
    if (error.code === 'P2002') {
      return res.status(400).json({ message: "You have already voted on this question." });
    }
    console.error("🔥 Voting Error:", error);
    res.status(500).json({ message: "Failed to record vote" });
  }
};

/**
 * 5. GET QUEST STATS (Admin Only)
 * Fetches the active question with ALL responses for the live feed.
 */
export const getQuestStats = async (req: Request, res: Response) => {
  try {
    const question = await prisma.dailyQuestion.findFirst({
      where: { isActive: true },
      include: { 
        options: true,
        // ✅ CRITICAL FIX: No 'where: { userId }' filter here.
        // We want ALL responses so the admin can see the total count.
        responses: {
          include: { 
            user: { select: { name: true, avatar: true } } 
          },
          orderBy: { createdAt: 'desc' } // Show newest votes top
        }
      }
    });

    res.json(question);
  } catch (error) {
    res.status(500).json({ message: "Error fetching quest stats" });
  }
};



