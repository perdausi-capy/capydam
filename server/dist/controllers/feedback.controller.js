"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOwnFeedback = exports.getMyFeedback = exports.deleteFeedback = exports.replyToFeedback = exports.updateFeedbackStatus = exports.getAllFeedback = exports.submitFeedback = void 0;
const client_1 = require("@prisma/client");
const supabase_1 = require("../utils/supabase"); // ✅ Import upload utility
const fs_extra_1 = __importDefault(require("fs-extra")); // ✅ Import fs for cleanup
const prisma = new client_1.PrismaClient();
// --- 1. Create Feedback (With Attachment Support) ---
const submitFeedback = async (req, res) => {
    const authReq = req;
    const { type, subject, message } = req.body;
    const userId = authReq.user?.id;
    if (!userId)
        return res.status(401).json({ message: "User not identified" });
    if (!subject || !message)
        return res.status(400).json({ message: "Subject and message required" });
    let attachmentUrl = null;
    try {
        // ✅ Handle File Upload
        if (authReq.file) {
            try {
                const { path: tempPath, originalname, mimetype } = authReq.file;
                const ext = originalname.split('.').pop();
                const filename = `feedback/${userId}-${Date.now()}.${ext}`;
                // Upload to Supabase bucket
                attachmentUrl = await (0, supabase_1.uploadToSupabase)(tempPath, filename, mimetype);
                // Clean up temp file
                await fs_extra_1.default.remove(tempPath).catch(() => { });
            }
            catch (uploadError) {
                console.error("Attachment upload failed:", uploadError);
                // We continue creating the feedback even if upload fails, but you could return error here
            }
        }
        // Save to Database
        const newFeedback = await prisma.feedback.create({
            data: {
                userId,
                type,
                subject,
                message,
                attachment: attachmentUrl, // ✅ Save the URL
                status: 'new'
            }
        });
        res.status(201).json(newFeedback);
    }
    catch (error) {
        console.error("Submit Feedback Error:", error);
        // Cleanup file if DB failed
        if (authReq.file?.path) {
            await fs_extra_1.default.remove(authReq.file.path).catch(() => { });
        }
        res.status(500).json({ message: "Server error" });
    }
};
exports.submitFeedback = submitFeedback;
// --- 2. Get All Feedback (Admin) ---
const getAllFeedback = async (req, res) => {
    try {
        const allFeedback = await prisma.feedback.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: { select: { name: true, email: true, avatar: true } }
            }
        });
        res.json(allFeedback);
    }
    catch (error) {
        console.error("Get Feedback Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.getAllFeedback = getAllFeedback;
// --- 3. Update Status (Admin) ---
const updateFeedbackStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const updated = await prisma.feedback.update({
            where: { id },
            data: { status }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.updateFeedbackStatus = updateFeedbackStatus;
// --- 4. Reply to Feedback (Admin) ---
const replyToFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        if (!message)
            return res.status(400).json({ message: "Reply message is required" });
        const updatedFeedback = await prisma.feedback.update({
            where: { id },
            data: {
                adminReply: message,
                repliedAt: new Date(),
                status: 'resolved' // Auto-mark resolved on reply
            }
        });
        res.json({ message: "Reply posted successfully", feedback: updatedFeedback });
    }
    catch (error) {
        console.error("Reply Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.replyToFeedback = replyToFeedback;
// --- 5. Delete Feedback (Admin) ---
const deleteFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.feedback.delete({ where: { id } });
        res.json({ message: "Feedback deleted" });
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.deleteFeedback = deleteFeedback;
// --- 6. Get My Feedback (User view) ---
const getMyFeedback = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const myFeedback = await prisma.feedback.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(myFeedback);
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.getMyFeedback = getMyFeedback;
// --- 7. Delete Own Feedback (User) ---
const deleteOwnFeedback = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        // Check ownership
        const feedback = await prisma.feedback.findUnique({ where: { id } });
        if (!feedback)
            return res.status(404).json({ message: "Feedback not found" });
        if (feedback.userId !== userId)
            return res.status(403).json({ message: "Forbidden" });
        // Delete
        await prisma.feedback.delete({ where: { id } });
        res.json({ message: "Feedback deleted successfully" });
    }
    catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
exports.deleteOwnFeedback = deleteOwnFeedback;
