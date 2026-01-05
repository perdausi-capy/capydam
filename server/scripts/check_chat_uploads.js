const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkChatUploads() {
  console.log("\n🔍 Checking database for Chat Messages with Attachments...\n");

  try {
    // 1. Get the last 20 messages, newest first
    const messages = await prisma.message.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        attachmentUrl: true,
        attachmentType: true,
        attachmentName: true,
        createdAt: true,
        user: { select: { name: true } }
      }
    });

    if (messages.length === 0) {
      console.log("❌ No messages found in the database!");
      return;
    }

    let foundAttachments = 0;

    messages.forEach(msg => {
      const hasAttachment = !!msg.attachmentUrl;
      const icon = hasAttachment ? '📎' : '💬';
      
      console.log(`------------------------------------------------`);
      console.log(`${icon} [${msg.createdAt.toLocaleString()}] ${msg.user?.name || 'Unknown'}`);
      console.log(`   Content: "${msg.content}"`);

      if (hasAttachment) {
        foundAttachments++;
        console.log(`   ✅ Attachment Found:`);
        console.log(`      - Name: ${msg.attachmentName}`);
        console.log(`      - Type: ${msg.attachmentType}`);
        console.log(`      - URL:  ${msg.attachmentUrl}`);
      } else {
        console.log(`   ❌ No Attachment Data`);
      }
    });

    console.log(`------------------------------------------------`);
    console.log(`\n📊 Summary: Found ${foundAttachments} attachments in the last ${messages.length} messages.`);
    
    if (foundAttachments === 0) {
      console.log(`👉 If you tried uploading files but see 0 here, the frontend didn't send the data to the socket correctly.`);
    }

  } catch (error) {
    console.error("Error fetching messages:", error);
  }
}

checkChatUploads()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });