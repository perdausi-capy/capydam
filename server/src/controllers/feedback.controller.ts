import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
// ✅ CORRECTED IMPORT: Pointing to MinIO service
import { uploadToSupabase } from '../services/storage.service';
import fs from 'fs-extra'; 

const prisma = new PrismaClient();

// Helper Interface for File Uploads
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  user?: { id: string };
}

// 1. Create Feedback (With Attachment Support)
export const submitFeedback = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest & MulterRequest;
  const { type, subject, message } = req.body;
  const userId = authReq.user?.id;

  if (!userId) return res.status(401).json({ message: "User not identified" });
  if (!subject || !message) return res.status(400).json({ message: "Subject and message required" });

  let attachmentUrl = null;

  try {
    // ✅ Handle File Upload
    if (authReq.file) {
      try {
        const { path: tempPath, originalname, mimetype } = authReq.file;
        const ext = originalname.split('.').pop();
        const filename = `feedback/${userId}-${Date.now()}.${ext}`;

        // Upload to MinIO bucket
        attachmentUrl = await uploadToSupabase(tempPath, filename, mimetype);

        // Clean up temp file
        await fs.remove(tempPath).catch(() => {});
      } catch (uploadError) {
        console.error("Attachment upload failed:", uploadError);
        // We continue creating the feedback even if upload fails
      }
    }

    // Save to Database
    const newFeedback = await prisma.feedback.create({
      data: {
        userId,
        type,
        subject,
        message,
        attachment: attachmentUrl, // ✅ Save the MinIO URL
        status: 'new'
      }
    });

    res.status(201).json(newFeedback);
  } catch (error) {
    console.error("Submit Feedback Error:", error);
    // Cleanup file if DB failed
    if (authReq.file?.path) {
      await fs.remove(authReq.file.path).catch(() => {});
    }
    res.status(500).json({ message: "Server error" });
  }
};

// 2. Get All Feedback (Admin)
export const getAllFeedback = async (req: Request, res: Response) => {
  try {
    const allFeedback = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, avatar: true } }
      }
    });
    res.json(allFeedback);
  } catch (error) {
    console.error("Get Feedback Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 3. Update Status (Admin)
export const updateFeedbackStatus = async (req: Request, res: Response) => {
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

// 4. Reply to Feedback (Admin)
export const replyToFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) return res.status(400).json({ message: "Reply message is required" });

    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: {
        adminReply: message,
        repliedAt: new Date(),
        status: 'resolved' // Auto-mark resolved on reply
      }
    });

    res.json({ message: "Reply posted successfully", feedback: updatedFeedback });
  } catch (error) {
    console.error("Reply Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 5. Delete Feedback (Admin)
export const deleteFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.feedback.delete({ where: { id } });
    res.json({ message: "Feedback deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// 6. Get My Feedback (User view)
export const getMyFeedback = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const myFeedback = await prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(myFeedback);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// 7. Delete Own Feedback (User)
export const deleteOwnFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Check ownership
    const feedback = await prisma.feedback.findUnique({ where: { id } });
    if (!feedback) return res.status(404).json({ message: "Feedback not found" });
    if (feedback.userId !== userId) return res.status(403).json({ message: "Forbidden" });

    // Delete
    await prisma.feedback.delete({ where: { id } });
    res.json({ message: "Feedback deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};