"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function check() {
    console.log("🔍 Checking first 10 assets...");
    const assets = await prisma.asset.findMany({
        take: 10,
        select: { id: true, filename: true, originalName: true }
    });
    console.table(assets);
}
check().finally(() => prisma.$disconnect());
