import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';

const prisma = new PrismaClient();

// --- 1. Submit Feedback ---
export const submitFeedback = async (req: any, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const { type, subject, message } = req.body;
    const userId = authReq.user?.id;

    if (!userId) return res.status(401).json({ message: "User not identified" });
    if (!subject || !message) return res.status(400).json({ message: "Subject and message required" });

    const newFeedback = await prisma.feedback.create({
      data: {
        userId,
        type,
        subject,
        message,
        status: 'new'
      }
    });

    res.status(201).json(newFeedback);
  } catch (error) {
    console.error("Submit Feedback Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- 2. Get All Feedback (Admin) ---
export const getAllFeedback = async (req: any, res: Response) => {
  try {
    const allFeedback = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    // Flatten data for frontend
    const formatted = allFeedback.map(f => ({
      ...f,
      userName: f.user.name,
      userEmail: f.user.email
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Get Feedback Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- 3. Update Status (Admin) ---
export const updateFeedbackStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.feedback.update({
      where: { id },
      data: { status }
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// --- 4. Delete Feedback (Admin) ---
export const deleteFeedback = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.feedback.delete({ where: { id } });
    res.json({ message: "Feedback deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const replyToFeedback = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body; // The admin's reply

    if (!message) return res.status(400).json({ message: "Reply message is required" });

    // Update the feedback entry with the reply
    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: { 
        adminReply: message,  // ✅ Save reply to DB
        repliedAt: new Date(),
        status: 'resolved'    // Auto-mark as resolved
      }
    });

    res.json({ message: "Reply posted successfully", feedback: updatedFeedback });

  } catch (error) {
    console.error("Reply Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// --- [GET] Get My Feedback (User view) ---
export const getMyFeedback = async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    
    const myFeedback = await prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(myFeedback);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteOwnFeedback = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 1. Check if feedback exists and belongs to user
    const feedback = await prisma.feedback.findUnique({
      where: { id }
    });

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    if (feedback.userId !== userId) {
      return res.status(403).json({ message: "You can only delete your own feedback" });
    }

    // 2. Delete it
    await prisma.feedback.delete({ where: { id } });

    res.json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};