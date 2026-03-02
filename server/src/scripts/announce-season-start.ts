import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables [cite: 1046, 1379]
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const prisma = new PrismaClient();

/**
 * Builds the rich-text payload for a professional ClickUp banner announcement[cite: 530, 542].
 */
const buildSeasonStartPayload = (seasonName: string) => {
  return {
    notify_all: true,
    comment: [
      {
        type: "emoticon",
        emoticon: { code: "1f680", name: "rocket", type: "default" },
        text: "🚀"
      },
      {
        text: `  ${seasonName} SEASON HAS BEGUN!  `,
        attributes: { bold: true }
      },
      {
        text: "\n",
        attributes: {
          "advanced-banner": "8b461d23-f294-4683-8826-2cb9bf991071",
          "advanced-banner-color": "green",
          header: 3
        }
      },
      { text: "\n", attributes: {} },
      { text: "The leaderboard has been wiped clean and streaks have been reset.", attributes: { italic: true } },
      { text: "\n", attributes: {} },
      { text: "A new race for the top spot begins NOW. Good luck, units!", attributes: { bold: true } },
      { text: "\n", attributes: {} },
      { text: "\n", attributes: { align: "center" } }
    ]
  };
};

const announceSeasonStart = async () => {
  try {
    console.log("🚀 [SCRIPT] Preparing Season Start Announcement...");

    // Fetch the current season start date from SystemConfig [cite: 622]
    const startConfig = await prisma.systemConfig.findUnique({ where: { key: 'SEASON_START' } });
    const startDate = startConfig ? new Date(startConfig.value) : new Date();
    
    // Format the season name based on the start date [cite: 625]
    const seasonName = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    // 📣 FIRE CLICKUP ANNOUNCEMENT [cite: 639]
    const token = process.env.CLICKUP_API_TOKEN;
    const chatId = process.env.CLICKUP_LIST_ID;

    if (token && chatId) {
      console.log(`📣 Firing ClickUp Announcement for ${seasonName}...`);
      try {
        await axios.post(
          `https://api.clickup.com/api/v2/view/${chatId}/comment`,
          buildSeasonStartPayload(seasonName),
          { headers: { 'Authorization': token, 'Content-Type': 'application/json' } }
        );
        console.log("✅ ClickUp Announcement Posted!");
      } catch (err: any) {
        console.error("❌ ClickUp Announcement Failed:", err.message);
      }
    } else {
      console.warn("⚠️ ClickUp API credentials missing in .env.");
    }

    console.log("\n🎉 [SUCCESS] Season start announcement sequence complete!");
  } catch (error) {
    console.error("\n❌ [ERROR] Script failed:", error);
  } finally {
    await prisma.$disconnect();
  }
};

announceSeasonStart();