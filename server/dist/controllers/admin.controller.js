"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminStats = void 0;
const prisma_1 = require("../lib/prisma");
// This function fetches counts for the Admin Sidebar Badges
const getAdminStats = async (req, res) => {
    try {
        // 1. Count Pending Users (Run first)
        const pendingUsers = await prisma_1.prisma.user.count({
            where: { status: 'PENDING' }
        });
        // 2. Count New Feedback (Run second, reusing the connection)
        const newFeedback = await prisma_1.prisma.feedback.count({
            where: { status: 'new' }
        });
        res.json({
            pendingUsers,
            newFeedback
        });
    }
    catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
};
exports.getAdminStats = getAdminStats;
