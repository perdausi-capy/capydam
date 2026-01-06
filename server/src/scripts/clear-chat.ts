// server/clear-chat.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Cleaning Chat Data...');
  
  // Order matters due to Foreign Keys!
  await prisma.notification.deleteMany({});
  await prisma.reaction.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.membership.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  
  console.log('✨ Chat tables wiped successfully!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());