"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/prisma/seed.ts
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    const email = 'capytech@dam.admin';
    const password = await bcryptjs_1.default.hash('Capytech2025!', 10);
    const admin = await prisma.user.upsert({
        where: { email },
        update: { status: 'ACTIVE' },
        create: {
            email,
            name: 'Admin User',
            password,
            role: 'admin',
            status: 'ACTIVE', // Set active on creation
        },
    });
    console.log({ admin });
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
