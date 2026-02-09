import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

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

  } catch (error) {
    console.error("🔥 Error:", error);
  } finally {
      await prisma.$disconnect();
  }
};

const notifyIntegrations = async (questionText: string) => {
    const token = process.env.CLICKUP_API_TOKEN;
    const chatId = process.env.CLICKUP_LIST_ID;
    
    if (!token || !chatId) {
        console.log("   ⚠️ Skipping ClickUp notification (Env vars missing)");
        return;
    }

    console.log("   📨 Sending notification to ClickUp...");

    const message = 
      `__________________________________________\n` +
      `🤖 MANUAL SYSTEM OVERRIDE\n` +
      `__________________________________________\n\n` +
      `QUESTION: "${questionText}"\n\n` +
      `👉 ANSWER HERE: https://dam.capy-dev.com\n` +
      `__________________________________________`;

    try {
      await axios.post(
        `https://api.clickup.com/api/v2/view/${chatId}/comment`,
        { comment_text: message, notify_all: true },
        { headers: { 'Authorization': token, 'Content-Type': 'application/json' } }
      );
      console.log("   ✅ Notification sent.");
    } catch (error: any) {
      console.error("   ❌ Notification failed:", error.message);
    }
};

// Run it
triggerQuest();