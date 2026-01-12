"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// server/clear-chat.ts
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
