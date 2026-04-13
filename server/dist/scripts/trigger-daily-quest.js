"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const prisma = new client_1.PrismaClient();
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
            // 3. THE ACTUAL QUESTION (Now a True Blockquote)
            // ==========================================
            // Bold, Italicized, and wrapped in a native Blockquote
            { text: questionText, attributes: { italic: true, bold: true } },
            { text: "\n", attributes: { blockquote: true } }, // <--- CHANGED HERE
            { text: "\n", attributes: {} },
            // ==========================================
            // 4. REWARDS / INFO (Now Blockquotes instead of Bullets)
            // ==========================================
            {
                type: "emoticon",
                emoticon: { code: "1f48e", name: "gem", type: "default" }, // 💎
                text: "💎"
            },
            { text: " Reward: ", attributes: { bold: true } },
            { text: "+10 XP", attributes: { code: true } }, // Uses code block to make the XP pop!
            { text: " for the correct answer.", attributes: {} },
            { text: "\n", attributes: { blockquote: true } }, // <--- CHANGED HERE
            {
                type: "emoticon",
                emoticon: { code: "1f525", name: "fire", type: "default" }, // 🔥
                text: "🔥"
            },
            { text: " Streak: ", attributes: { bold: true } },
            { text: "Keep your consecutive answer streak alive!", attributes: {} },
            { text: "\n", attributes: { blockquote: true } }, // <--- CHANGED HERE
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
                emoticon: { code: "1f680", name: "rocket", type: "default" },
                text: "🦫"
            },
            { text: "  SUBMIT YOUR ANSWER HERE  ", attributes: { bold: true, link: "https://dam.capy-dev.com" } },
            {
                type: "emoticon",
                emoticon: { code: "1f680", name: "rocket", type: "default" },
                text: "🦫"
            },
            { text: "\n", attributes: { align: "center" } } // Centers the entire line perfectly
        ]
    };
};
const triggerQuest = async () => {
    try {
        console.log("🚀 MANUALLY TRIGGERING DAILY QUEST ROTATION...");
        // 1. KILL SWITCH: Deactivate ALL currently active quests
        console.log("   💀 Deactivating old quests...");
        const deactivated = await prisma.dailyQuestion.updateMany({
            where: { isActive: true },
            data: { isActive: false }
        });
        console.log(`   ✅ Deactivated ${deactivated.count} quest(s).`);
        // 2. FETCH RANDOM FROM VAULT
        // ✅ NEW RULE: expiresAt must be NULL. 
        // This guarantees we only pick questions that have NEVER been used.
        console.log("   🔍 Searching Vault for fresh content...");
        const whereCondition = {
            isActive: false,
            expiresAt: null
        };
        const count = await prisma.dailyQuestion.count({ where: whereCondition });
        if (count === 0) {
            console.log("   ❌ VAULT IS EMPTY! No fresh questions found. (Used questions are ignored)");
            return;
        }
        // Pick a random offset
        const skip = Math.floor(Math.random() * count);
        const questToLaunch = await prisma.dailyQuestion.findFirst({
            where: whereCondition,
            skip: skip,
            include: { options: true }
        });
        // 3. LAUNCH SEQUENCE
        if (questToLaunch) {
            // Set expiry for 24 hours from now
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            await prisma.dailyQuestion.update({
                where: { id: questToLaunch.id },
                data: {
                    isActive: true,
                    scheduledFor: null,
                    createdAt: new Date(), // Bump timestamp so it appears at top of lists
                    expiresAt: expiresAt // This marks it as "Used" forever
                }
            });
            console.log(`   ✨ SUCCESS! Launched: "${questToLaunch.question}"`);
            console.log(`   ⏳ Expires at: ${expiresAt.toLocaleString()}`);
            // Optional: Trigger Notification
            await notifyIntegrations(questToLaunch.question);
        }
    }
    catch (error) {
        console.error("🔥 Error:", error);
    }
    finally {
        await prisma.$disconnect();
    }
};
const notifyIntegrations = async (questionText) => {
    const token = process.env.CLICKUP_API_TOKEN;
    const chatId = process.env.CLICKUP_LIST_ID;
    if (!token || !chatId) {
        console.log("   ⚠️ Skipping ClickUp notification (Env vars missing)");
        return;
    }
    console.log("   📨 Sending notification to ClickUp...");
    // ✅ Generate the Professional Rich-Text Payload
    const clickUpPayload = buildClickUpPayload("DAILY QUEST MANUAL OVERRIDE", "1f916", // 🤖 unicode
    "🤖", questionText);
    try {
        await axios_1.default.post(`https://api.clickup.com/api/v2/view/${chatId}/comment`, clickUpPayload, // ✅ Pass the JSON object directly (it already includes notify_all)
        { headers: { 'Authorization': token, 'Content-Type': 'application/json' } });
    }
    catch (error) {
        console.error("❌ Notification failed:", error.message);
    }
};
// Run it
triggerQuest();
