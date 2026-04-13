"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastSeasonRecap = exports.claimGoldenCapy = exports.getGoldenStatus = exports.recycleAllHistory = exports.recycleToVault = exports.getQuestDetails = exports.clearHistory = exports.clearVault = exports.deleteDailyQuestion = exports.unscheduleQuest = exports.aiSmartImport = exports.generateQuest = exports.generateDailyQuestion = exports.resetAllTimeStats = exports.endSeason = exports.startSeason = exports.getLeaderboard = exports.getQuestStats = exports.closeQuest = exports.createDailyQuestion = exports.submitVote = exports.getActiveQuestion = void 0;
const prisma_1 = require("../lib/prisma");
const axios_1 = __importDefault(require("axios"));
const ai_service_1 = require("../services/ai.service");
const file_service_1 = require("../services/file.service");
/* =========================================
   CORE GAME LOOP (Public)
   ========================================= */
// Helper to generate ClickUp Rich Text Array
// --- PRO-TIER CLICKUP HELPER FUNCTION ---
const buildClickUpPayload = (title, emojiCode, emojiChar, questionText) => {
    return {
        notify_all: true,
        comment: [
            // ==========================================
            // 1. BANNER HEADER
            // ==========================================
            {
                type: "emoticon",
                emoticon: { code: emojiCode, name: "icon", type: "default" },
                text: emojiChar
            },
            {
                text: `  ${title}`, // Extra space for breathing room
                attributes: { bold: true }
            },
            {
                text: "\n",
                attributes: {
                    "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071",
                    "advanced-banner-color": "blue-strong",
                    header: 3
                }
            },
            { text: "\n", attributes: {} },
            // ==========================================
            // 2. QUESTION HEADER
            // ==========================================
            { text: "Today's Challenge", attributes: { bold: true, underline: true } },
            { text: "\n", attributes: {} },
            // ==========================================
            // 3. THE ACTUAL QUESTION 
            // ==========================================
            // Bold, Italicized, and Indented to look like a professional blockquote
            { text: questionText, attributes: { italic: true, bold: true } },
            { text: "\n", attributes: { indent: 1 } },
            { text: "\n", attributes: {} },
            // ==========================================
            // 4. REWARDS / INFO (Bulleted List)
            // ==========================================
            {
                type: "emoticon",
                emoticon: { code: "1f48e", name: "gem", type: "default" }, // 💎
                text: "💎"
            },
            { text: " Reward: ", attributes: { bold: true } },
            { text: "+10 XP", attributes: { code: true } }, // Uses code block to make the XP pop!
            { text: " for the correct answer.", attributes: {} },
            { text: "\n", attributes: { list: { list: "bullet" } } }, // Formats as Bullet 1
            {
                type: "emoticon",
                emoticon: { code: "1f525", name: "fire", type: "default" }, // 🔥
                text: "🔥"
            },
            { text: " Streak: ", attributes: { bold: true } },
            { text: "Keep your consecutive answer streak alive!", attributes: {} },
            { text: "\n", attributes: { list: { list: "bullet" } } }, // Formats as Bullet 2
            { text: "\n", attributes: {} },
            // ==========================================
            // 5. DIVIDER
            // ==========================================
            { type: "divider", text: "---" },
            { text: "\n", attributes: {} },
            // ==========================================
            // 6. CALL TO ACTION (CENTERED)
            // ==========================================
            {
                type: "emoticon",
                emoticon: { code: "1f680", name: "rocket", type: "default" }, // 🚀
                text: "🚀"
            },
            { text: "  SUBMIT YOUR ANSWER HERE  ", attributes: { bold: true, link: "https://dam.capy-dev.com" } },
            {
                type: "emoticon",
                emoticon: { code: "1f680", name: "rocket", type: "default" }, // 🚀
                text: "🚀"
            },
            { text: "\n", attributes: { align: "center" } } // Centers the entire line perfectly
        ]
    };
};
// --- SEASON RECAP CLICKUP PAYLOAD ---
const buildSeasonRecapPayload = (seasonName, top3) => {
    // ✅ FIX: Added ': any[]' so TypeScript stops complaining about .push()
    const comment = [
        // ==========================================
        // 1. BANNER HEADER
        // ==========================================
        {
            type: "emoticon",
            emoticon: { code: "1f3c6", name: "trophy", type: "default" },
            text: "🏆"
        },
        {
            text: `  ${seasonName} SEASON FINALE  `,
            attributes: { bold: true }
        },
        {
            text: "\n",
            attributes: {
                "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071",
                "advanced-banner-color": "yellow",
                header: 3
            }
        },
        { text: "\n", attributes: {} },
        { text: "The dust has settled. The scores are tallied. Here are your Champions:", attributes: { italic: true } },
        { text: "\n", attributes: {} },
        { text: "\n", attributes: {} }
    ];
    const medals = [
        { emoji: "🥇", code: "1f947", name: "1st_place_medal", label: "1st Place", xp: "5000 XP" },
        { emoji: "🥈", code: "1f948", name: "2nd_place_medal", label: "2nd Place", xp: "2500 XP" },
        { emoji: "🥉", code: "1f949", name: "3rd_place_medal", label: "3rd Place", xp: "1000 XP" }
    ];
    // ==========================================
    // 2. DYNAMIC WINNERS LIST
    // ==========================================
    top3.forEach((user, index) => {
        if (user) {
            comment.push({
                type: "emoticon",
                emoticon: { code: medals[index].code, name: medals[index].name, type: "default" },
                text: medals[index].emoji
            });
            comment.push({ text: ` ${medals[index].label}: `, attributes: { bold: true } });
            comment.push({ text: `${user.name} `, attributes: {} });
            comment.push({ text: `(+${medals[index].xp})`, attributes: { code: true } });
            comment.push({ text: "\n", attributes: { blockquote: true } });
        }
    });
    // ==========================================
    // 3. FOOTER & CALL TO ACTION
    // ==========================================
    comment.push({ text: "\n", attributes: {} }, { type: "divider", text: "---" }, { text: "\n", attributes: {} }, { type: "emoticon", emoticon: { code: "1f634", name: "sleeping", type: "default" }, text: "😴" }, { text: "  A new season will begin shortly. Rest up, units!  ", attributes: { bold: true, italic: true } }, { type: "emoticon", emoticon: { code: "1f634", name: "sleeping", type: "default" }, text: "😴" }, { text: "\n", attributes: { align: "center" } });
    return {
        notify_all: true,
        comment: comment
    };
};
// 1. GET ACTIVE QUESTION
const getActiveQuestion = async (req, res) => {
    try {
        const userId = req.user?.id;
        const now = new Date();
        const question = await prisma_1.prisma.dailyQuestion.findFirst({
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
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching active question" });
    }
};
exports.getActiveQuestion = getActiveQuestion;
// 2. SUBMIT VOTE
// 2. SUBMIT VOTE
const submitVote = async (req, res) => {
    try {
        const { questionId, optionId } = req.body;
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ message: "Unauthorized" });
        const option = await prisma_1.prisma.questionOption.findUnique({ where: { id: optionId } });
        const isCorrect = option?.isCorrect || false;
        const points = isCorrect ? 10 : 0;
        // 1. Record the vote
        const vote = await prisma_1.prisma.dailyResponse.create({
            data: { userId, questionId, optionId }
        });
        // 2. Fetch user to update stats
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
            // ✅ NEW STREAK LOGIC: Consecutive Correct Answers
            let newStreak = 0;
            if (isCorrect) {
                // Answered correctly? Add 1 to their current streak
                newStreak = (user.streak || 0) + 1;
            }
            else {
                // Answered incorrectly? Streak resets to 0
                newStreak = 0;
            }
            // 3. Update the User profile
            await prisma_1.prisma.user.update({
                where: { id: userId },
                data: {
                    score: { increment: points },
                    streak: newStreak,
                    lastDailyDate: new Date()
                }
            });
        }
        // 4. Fetch updated stats for the frontend
        const stats = await prisma_1.prisma.questionOption.findMany({
            where: { questionId },
            include: { _count: { select: { responses: true } } }
        });
        res.json({ success: true, vote, stats, isCorrect, points });
    }
    catch (error) {
        // Prisma unique constraint error (User already voted)
        if (error.code === 'P2002') {
            return res.status(400).json({ message: "You have already voted on this quest." });
        }
        console.error("Submit Vote Error:", error);
        res.status(500).json({ message: "Failed to record vote" });
    }
};
exports.submitVote = submitVote;
/* =========================================
   ADMIN DASHBOARD & CREATE (Protected)
   ========================================= */
// 3. CREATE DAILY QUESTION
const createDailyQuestion = async (req, res) => {
    try {
        // We now look at 'isActive' to decide mode. 
        // If frontend sends scheduledFor: null, we treat it based on isActive status.
        const { question, options, isActive } = req.body;
        const shouldLaunch = isActive === true;
        if (shouldLaunch) {
            // ==========================================
            // 🚀 MODE 1: LAUNCH IMMEDIATELY
            // ==========================================
            // 1. Deactivate any existing active quests
            await prisma_1.prisma.dailyQuestion.updateMany({
                where: { isActive: true },
                data: { isActive: false }
            });
            // 2. Calculate Expiry (24 Hours from NOW)
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            // 3. Create the Active Question
            const newQuestion = await prisma_1.prisma.dailyQuestion.create({
                data: {
                    question,
                    isActive: true,
                    expiresAt: expiresAt, // ✅ FIX: Sets timer so it doesn't show as Expired
                    scheduledFor: null, // Active quests don't need a schedule date
                    options: {
                        create: options.map((opt) => ({
                            text: opt.text,
                            isCorrect: opt.isCorrect || false
                        }))
                    }
                },
                include: { options: true }
            });
            // 4. Send Notification
            const token = process.env.CLICKUP_API_TOKEN;
            const chatId = process.env.CLICKUP_LIST_ID;
            if (token && chatId) {
                // ✅ USE THE NEW RICH-TEXT FORMAT
                const clickUpPayload = buildClickUpPayload("CAPYDAM QUESTION OF THE DAY", "1f4e2", // 📢 unicode
                "📢", question);
                try {
                    await axios_1.default.post(`https://api.clickup.com/api/v2/view/${chatId}/comment`, clickUpPayload, // Send the JSON object directly
                    { headers: { 'Authorization': token, 'Content-Type': 'application/json' } });
                }
                catch (error) {
                    console.error("❌ ClickUp API Error:", error.message);
                }
            }
            return res.status(201).json(newQuestion);
        }
        else {
            // ==========================================
            // 📦 MODE 2: SAVE TO VAULT (Draft)
            // ==========================================
            // We removed the "Collision Check" (existingSchedule) so you can 
            // add as many drafts as you want without error.
            const newDraft = await prisma_1.prisma.dailyQuestion.create({
                data: {
                    question,
                    isActive: false,
                    scheduledFor: null, // Keep it null so it floats in the Vault pool
                    expiresAt: null, // ✅ FIX: Must be NULL to be considered "Fresh" by Cron
                    options: {
                        create: options.map((opt) => ({
                            text: opt.text,
                            isCorrect: opt.isCorrect || false
                        }))
                    }
                },
                include: { options: true }
            });
            return res.status(201).json(newDraft);
        }
    }
    catch (error) {
        console.error("🔥 Create Daily Question Error:", error);
        res.status(500).json({ message: "Failed to create daily question" });
    }
};
exports.createDailyQuestion = createDailyQuestion;
// 4. MANUAL KILL
const closeQuest = async (req, res) => {
    const { id } = req.params;
    await prisma_1.prisma.dailyQuestion.update({
        where: { id },
        data: { isActive: false }
    });
    res.json({ success: true });
};
exports.closeQuest = closeQuest;
// 5. GET QUEST STATS
// 5. GET QUEST STATS
const getQuestStats = async (req, res) => {
    try {
        const activeQuest = await prisma_1.prisma.dailyQuestion.findFirst({
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
        const totalUsers = await prisma_1.prisma.user.count({ where: { status: 'ACTIVE' } });
        // ✅ FIX: HISTORY ONLY shows items that were once active (have an expiry date)
        const history = await prisma_1.prisma.dailyQuestion.findMany({
            where: {
                isActive: false,
                scheduledFor: null,
                expiresAt: { not: null } // <--- CRITICAL FIX: Must have run before
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { _count: { select: { responses: true } } }
        });
        // ✅ FIX: DRAFTS ONLY shows items that have NEVER been active (expiresAt is null)
        const drafts = await prisma_1.prisma.dailyQuestion.findMany({
            where: {
                isActive: false,
                scheduledFor: null,
                expiresAt: null // <--- CRITICAL FIX: Must be fresh
            },
            include: { options: true },
            orderBy: { createdAt: 'desc' }
        });
        const scheduled = await prisma_1.prisma.dailyQuestion.findMany({
            where: {
                isActive: false,
                scheduledFor: { not: null }
            },
            orderBy: { scheduledFor: 'asc' },
            include: { options: true }
        });
        res.json({ activeQuest, totalUsers, history, drafts, scheduled });
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching quest stats" });
    }
};
exports.getQuestStats = getQuestStats;
/* =========================================
   SEASON & LEADERBOARD MANAGEMENT
   ========================================= */
// 6. GET LEADERBOARD (Updated: Show ALL users + Tiers)
// 6. GET LEADERBOARD (Priority: Points > Streak > Time)
const getLeaderboard = async (req, res) => {
    try {
        const currentUserId = req.user?.id;
        const { range } = req.query;
        // 1. Get Configs
        const statusConfig = await prisma_1.prisma.systemConfig.findUnique({ where: { key: 'SEASON_STATUS' } });
        const startConfig = await prisma_1.prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
        const endConfig = await prisma_1.prisma.systemConfig.findUnique({ where: { key: 'SEASON_END' } });
        const status = statusConfig?.value || 'ACTIVE';
        const seasonStart = startConfig ? new Date(startConfig.value) : new Date(0);
        const seasonEnd = endConfig ? new Date(endConfig.value) : new Date();
        // 2. Fetch ALL Active Users (Base List)
        const allUsers = await prisma_1.prisma.user.findMany({
            where: { status: 'ACTIVE' },
            // ✅ UPDATE: Added 'lastDailyDate' & 'updatedAt' so sorting works
            select: {
                id: true,
                name: true,
                avatar: true,
                streak: true,
                score: true,
                lastDailyDate: true,
                updatedAt: true
            }
        });
        let rankedUsers = [];
        // --- SEASON LOGIC ---
        if (range === 'monthly') {
            const endDateFilter = status === 'ENDED' ? seasonEnd : new Date();
            const seasonResponses = await prisma_1.prisma.dailyResponse.findMany({
                where: {
                    createdAt: { gte: seasonStart, lte: endDateFilter },
                    option: { isCorrect: true }
                }
            });
            const scoreMap = new Map();
            const timeMap = new Map(); // ✅ TRACKS EXACT MILLISECOND
            seasonResponses.forEach(r => {
                const current = scoreMap.get(r.userId) || 0;
                scoreMap.set(r.userId, current + 10);
                // Record the precise millisecond they earned these points
                const rTime = new Date(r.createdAt).getTime();
                const currentLastTime = timeMap.get(r.userId) || 0;
                if (rTime > currentLastTime) {
                    timeMap.set(r.userId, rTime);
                }
            });
            // Merge Season Score into User List
            rankedUsers = allUsers.map(user => ({
                ...user,
                score: scoreMap.get(user.id) || 0,
                // Fallback to their profile date only if they have 0 points
                timeReached: timeMap.get(user.id) || new Date(user.lastDailyDate || user.updatedAt || 0).getTime()
            }));
        }
        else {
            // --- ALL TIME LOGIC ---
            rankedUsers = allUsers.map(user => ({
                ...user,
                timeReached: new Date(user.lastDailyDate || user.updatedAt || 0).getTime()
            }));
        }
        // 3. 🧠 STRICT SORT LOGIC (Score > Streak > Exact Time)
        rankedUsers.sort((a, b) => {
            // Priority 1: POINTS
            if (b.score !== a.score)
                return b.score - a.score;
            // Priority 2: STREAK
            if ((b.streak || 0) !== (a.streak || 0))
                return (b.streak || 0) - (a.streak || 0);
            // Priority 3: EXACT TIME REACHED (Millisecond precision)
            if (a.timeReached !== b.timeReached)
                return a.timeReached - b.timeReached;
            // Final Tie-Breaker: Alphabetical
            return (a.name || '').localeCompare(b.name || '');
        });
        // 4. Assign Ranks
        const processedList = rankedUsers.slice(0, 100).map((u, i) => ({
            ...u,
            rank: u.score > 0 ? i + 1 : 0 // 0 = Unranked
        }));
        // 5. Find Current User Stats
        let currentUserStat = processedList.find(u => u.id === currentUserId);
        if (!currentUserStat && currentUserId) {
            const userDetails = allUsers.find(u => u.id === currentUserId);
            if (userDetails)
                currentUserStat = { ...userDetails, score: 0, rank: 0 };
        }
        res.json({
            leaders: processedList,
            user: currentUserStat,
            status: status
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Leaderboard error" });
    }
};
exports.getLeaderboard = getLeaderboard;
// 7. START SEASON
const startSeason = async (req, res) => {
    try {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ACTIVE' }, create: { key: 'SEASON_STATUS', value: 'ACTIVE' } }),
            prisma_1.prisma.systemConfig.upsert({ where: { key: 'SEASON_START' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_START', value: new Date().toISOString() } }),
            prisma_1.prisma.systemConfig.deleteMany({ where: { key: 'SEASON_END' } }),
            // ✅ MOVED HERE: Guarantee a 100% clean slate the exact moment the season begins!
            prisma_1.prisma.user.updateMany({ data: { streak: 0 } })
        ]);
        res.json({ message: "🚀 Season Started! Score tracking is live and streaks are reset." });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to start" });
    }
};
exports.startSeason = startSeason;
// 8. END SEASON
const endSeason = async (req, res) => {
    try {
        const startConfig = await prisma_1.prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
        const startDate = startConfig ? new Date(startConfig.value) : new Date(0);
        // 🚨 CRITICAL FIX: Named based on when the season STARTED, not the current date.
        const seasonName = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        const responses = await prisma_1.prisma.dailyResponse.findMany({
            where: { createdAt: { gte: startDate }, option: { isCorrect: true } },
            include: { user: true }
        });
        let top3 = [];
        let sortedUsers = []; // ✅ Lifted to outer scope for the snapshot
        if (responses.length > 0) {
            const scoreMap = new Map();
            const timeMap = new Map(); // ✅ TRACKS EXACT MILLISECOND
            responses.forEach(r => {
                const existing = scoreMap.get(r.userId) || { ...r.user, score: 0 };
                existing.score += 10;
                existing.streak = r.user.streak || 0;
                scoreMap.set(r.userId, existing);
                const rTime = new Date(r.createdAt).getTime();
                const currentLastTime = timeMap.get(r.userId) || 0;
                if (rTime > currentLastTime)
                    timeMap.set(r.userId, rTime);
            });
            // ✅ GET ALL SORTED USERS (With Millisecond Tie-Breaker)
            sortedUsers = Array.from(scoreMap.values()).map(u => ({
                ...u,
                timeReached: timeMap.get(u.id) || 0
            })).sort((a, b) => {
                if (b.score !== a.score)
                    return b.score - a.score;
                if ((b.streak || 0) !== (a.streak || 0))
                    return (b.streak || 0) - (a.streak || 0);
                if (a.timeReached !== b.timeReached)
                    return a.timeReached - b.timeReached;
                return (a.name || '').localeCompare(b.name || '');
            });
            // ✅ GRAB TOP 3
            const first = sortedUsers[0];
            const second = sortedUsers[1];
            const third = sortedUsers[2];
            // 🚨 CRITICAL FIX: Populate the top3 array so rewards and announcements trigger!
            top3 = [first, second, third].filter(Boolean);
            if (top3[0]) {
                await prisma_1.prisma.seasonArchive.create({
                    data: {
                        seasonName, winnerId: top3[0].id, winnerName: top3[0].name, winnerAvatar: top3[0].avatar, winnerScore: top3[0].score, prizeAwarded: 5000
                    }
                });
                await prisma_1.prisma.user.update({ where: { id: top3[0].id }, data: { score: { increment: 5000 } } });
            }
            if (top3[1])
                await prisma_1.prisma.user.update({ where: { id: top3[1].id }, data: { score: { increment: 2500 } } });
            if (top3[2])
                await prisma_1.prisma.user.update({ where: { id: top3[2].id }, data: { score: { increment: 1000 } } });
        }
        // 📸 CREATE THE FROZEN SNAPSHOT (Top 50 users)
        const recapSnapshot = {
            seasonName: seasonName,
            leaders: sortedUsers.slice(0, 50)
        };
        // 🛑 Freezing Season Status and Saving Snapshot
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.systemConfig.upsert({ where: { key: 'SEASON_STATUS' }, update: { value: 'ENDED' }, create: { key: 'SEASON_STATUS', value: 'ENDED' } }),
            prisma_1.prisma.systemConfig.upsert({ where: { key: 'SEASON_END' }, update: { value: new Date().toISOString() }, create: { key: 'SEASON_END', value: new Date().toISOString() } }),
            // ✅ Save the snapshot to the config table!
            prisma_1.prisma.systemConfig.upsert({
                where: { key: 'LAST_SEASON_RECAP' },
                update: { value: JSON.stringify(recapSnapshot) },
                create: { key: 'LAST_SEASON_RECAP', value: JSON.stringify(recapSnapshot) }
            })
        ]);
        // 📣 FIRE CLICKUP ANNOUNCEMENT
        const token = process.env.CLICKUP_API_TOKEN;
        const chatId = process.env.CLICKUP_LIST_ID;
        if (token && chatId && top3.length > 0) {
            try {
                await axios_1.default.post(`https://api.clickup.com/api/v2/view/${chatId}/comment`, buildSeasonRecapPayload(seasonName, top3), { headers: { 'Authorization': token, 'Content-Type': 'application/json' } });
            }
            catch (err) {
                console.error("ClickUp Finale Post Failed:", err.message);
            }
        }
        res.json({ message: "🛑 Season Ended. Rewards distributed & Announced." });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to end" });
    }
};
exports.endSeason = endSeason;
// 9. FACTORY RESET
const resetAllTimeStats = async (req, res) => {
    try {
        await prisma_1.prisma.dailyResponse.deleteMany({});
        await prisma_1.prisma.user.updateMany({
            data: { score: 0, streak: 0, lastDailyDate: null }
        });
        await prisma_1.prisma.systemConfig.upsert({
            where: { key: 'SEASON_START' },
            update: { value: new Date().toISOString() },
            create: { key: 'SEASON_START', value: new Date().toISOString() }
        });
        res.json({ message: "⚠️ GLOBAL RESET COMPLETE. All scores and history wiped." });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to reset all-time stats" });
    }
};
exports.resetAllTimeStats = resetAllTimeStats;
/* =========================================
   AI, VAULT & TOOLS
   ========================================= */
// 10. GENERATE FROM VAULT
const generateDailyQuestion = async (req, res) => {
    try {
        const whereCondition = { isActive: false, responses: { none: {} }, scheduledFor: null };
        const count = await prisma_1.prisma.dailyQuestion.count({ where: whereCondition });
        if (count === 0)
            return res.status(404).json({ message: "Vault is empty!" });
        const skip = Math.floor(Math.random() * count);
        const randomQuestion = await prisma_1.prisma.dailyQuestion.findFirst({
            where: whereCondition,
            include: { options: true },
            skip: skip
        });
        res.json(randomQuestion);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch from Vault" });
    }
};
exports.generateDailyQuestion = generateDailyQuestion;
// 11. AI GENERATE (Optional)
const generateQuest = async (req, res) => {
    try {
        const { topic } = req.body;
        const aiData = await (0, ai_service_1.generateQuestWithAI)(topic);
        if (!aiData)
            return res.status(500).json({ message: "AI failed to generate quest" });
        res.json(aiData);
    }
    catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};
exports.generateQuest = generateQuest;
// 12. AI SMART IMPORT (File -> DB)
const aiSmartImport = async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ message: "No file uploaded" });
        const rawText = await (0, file_service_1.extractTextFromFile)(req.file);
        if (!rawText || rawText.length < 10)
            return res.status(400).json({ message: "File appears empty or unreadable." });
        const questions = await (0, ai_service_1.parseQuestionsWithAI)(rawText);
        if (!questions || !Array.isArray(questions) || questions.length === 0)
            return res.status(400).json({ message: "AI could not find valid questions." });
        const created = await prisma_1.prisma.$transaction(questions.map((q) => prisma_1.prisma.dailyQuestion.create({
            data: {
                question: q.question,
                isActive: false,
                expiresAt: null, // ✅ FIX: Explicitly NULL so it counts as "Fresh"
                options: {
                    create: q.options.map((opt) => ({
                        text: opt.text,
                        isCorrect: opt.isCorrect || false
                    }))
                }
            }
        })));
        res.json({ message: `✨ Magic! Extracted ${created.length} quests.`, count: created.length });
    }
    catch (error) {
        console.error("Import Error:", error);
        res.status(500).json({ message: error.message || "Server error during import" });
    }
};
exports.aiSmartImport = aiSmartImport;
// 13. UNSCHEDULE
const unscheduleQuest = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.dailyQuestion.update({
            where: { id },
            data: { scheduledFor: null }
        });
        res.json({ message: "Quest unscheduled and moved to Vault." });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to unschedule quest." });
    }
};
exports.unscheduleQuest = unscheduleQuest;
// 14. DELETE
const deleteDailyQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.prisma.dailyQuestion.delete({ where: { id } });
        res.json({ message: "Item deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to delete item" });
    }
};
exports.deleteDailyQuestion = deleteDailyQuestion;
// 15. CLEAR VAULT
const clearVault = async (req, res) => {
    try {
        const { count } = await prisma_1.prisma.dailyQuestion.deleteMany({
            where: {
                isActive: false,
                responses: { none: {} },
                scheduledFor: null,
                expiresAt: null // ✅ CRITICAL: Only delete items that never had a timer
            }
        });
        res.json({ message: `Vault cleared! Removed ${count} items.` });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to clear vault" });
    }
};
exports.clearVault = clearVault;
// 16. CLEAR HISTORY
const clearHistory = async (req, res) => {
    try {
        const { count } = await prisma_1.prisma.dailyQuestion.deleteMany({
            where: {
                isActive: false,
                expiresAt: { not: null } // ✅ CRITICAL: Only delete items that WERE active once
            }
        });
        res.json({ message: `History cleared! Removed ${count} items.` });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to clear history" });
    }
};
exports.clearHistory = clearHistory;
// ✅ NEW: GET SINGLE QUEST DETAILS (For History Drill-down)
const getQuestDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const quest = await prisma_1.prisma.dailyQuestion.findUnique({
            where: { id },
            include: {
                options: true,
                responses: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true, email: true } },
                        option: true
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!quest) {
            return res.status(404).json({ message: "Quest not found" });
        }
        res.json(quest);
    }
    catch (error) {
        console.error("Detail Error:", error);
        res.status(500).json({ message: "Error fetching quest details" });
    }
};
exports.getQuestDetails = getQuestDetails;
// 17. RECYCLE SINGLE QUEST (Move 1 item back to Vault)
const recycleToVault = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await prisma_1.prisma.dailyQuestion.update({
            where: { id },
            data: {
                isActive: false, // 1. Take it out of the game
                expiresAt: null, // 2. Remove the "Battle Scar" (Makes it "Fresh" again)
                scheduledFor: null // 3. Ensure it's not sitting in the schedule
            }
        });
        res.json({ message: "♻️ Quest recycled back to the Vault!", quest: updated });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to recycle quest" });
    }
};
exports.recycleToVault = recycleToVault;
// 18. RECYCLE ALL HISTORY (Move all played items back to Vault)
const recycleAllHistory = async (req, res) => {
    try {
        const { count } = await prisma_1.prisma.dailyQuestion.updateMany({
            where: {
                isActive: false,
                expiresAt: { not: null } // ✅ Targeted: Only items that were once active
            },
            data: {
                expiresAt: null, // ✅ Verified: Resets them to "Fresh" status
                scheduledFor: null
            }
        });
        res.json({ message: `♻️ Success! Recycled ${count} items back to the Vault.` });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to recycle history" });
    }
};
exports.recycleAllHistory = recycleAllHistory;
// --- GOLDEN CAPYBARA LOGIC ---
// 1. CHECK STATUS (Frontend calls this to see if it should spawn)
const getGoldenStatus = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // "2026-02-18"
        const dateConfig = await prisma_1.prisma.systemConfig.findUnique({ where: { key: 'GOLDEN_DATE' } });
        const countConfig = await prisma_1.prisma.systemConfig.findUnique({ where: { key: 'GOLDEN_COUNT' } });
        // If it's a new day, we act as if count is 0
        let count = 0;
        if (dateConfig?.value === today) {
            count = parseInt(countConfig?.value || '0', 10);
        }
        const limit = 3;
        const remaining = Math.max(0, limit - count);
        res.json({
            available: remaining > 0,
            remaining,
            totalClaimed: count
        });
    }
    catch (error) {
        res.status(500).json({ available: false });
    }
};
exports.getGoldenStatus = getGoldenStatus;
// 2. CLAIM REWARD (Strict Check + 5 Points)
const claimGoldenCapy = async (req, res) => {
    try {
        const userId = req.user.id;
        const today = new Date().toISOString().split('T')[0];
        // Transaction to ensure no race conditions
        await prisma_1.prisma.$transaction(async (tx) => {
            // A. Check/Reset Date
            const dateConfig = await tx.systemConfig.findUnique({ where: { key: 'GOLDEN_DATE' } });
            if (dateConfig?.value !== today) {
                // It's a new day! Reset everything.
                await tx.systemConfig.upsert({ where: { key: 'GOLDEN_DATE' }, update: { value: today }, create: { key: 'GOLDEN_DATE', value: today } });
                await tx.systemConfig.upsert({ where: { key: 'GOLDEN_COUNT' }, update: { value: '0' }, create: { key: 'GOLDEN_COUNT', value: '0' } });
            }
            // B. Check Count
            const countConfig = await tx.systemConfig.findUnique({ where: { key: 'GOLDEN_COUNT' } });
            const currentCount = parseInt(countConfig?.value || '0', 10);
            if (currentCount >= 3) {
                throw new Error("LIMIT_REACHED");
            }
            // C. Increment Count
            await tx.systemConfig.update({
                where: { key: 'GOLDEN_COUNT' },
                data: { value: (currentCount + 1).toString() }
            });
            // D. Give Points
            await tx.user.update({
                where: { id: userId },
                data: { score: { increment: 5 } }
            });
        });
        res.json({ success: true, message: "Golden Capy Claimed!", points: 5 });
    }
    catch (error) {
        if (error.message === "LIMIT_REACHED") {
            return res.status(410).json({ message: "Too slow! All Capys found today." });
        }
        console.error(error);
        res.status(500).json({ message: "Error claiming bonus" });
    }
};
exports.claimGoldenCapy = claimGoldenCapy;
// 19. GET LAST SEASON RECAP SNAPSHOT
const getLastSeasonRecap = async (req, res) => {
    try {
        const recapConfig = await prisma_1.prisma.systemConfig.findUnique({ where: { key: 'LAST_SEASON_RECAP' } });
        if (!recapConfig)
            return res.json(null);
        res.json(JSON.parse(recapConfig.value));
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch recap snapshot" });
    }
};
exports.getLastSeasonRecap = getLastSeasonRecap;
