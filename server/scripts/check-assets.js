const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const all = await prisma.asset.findMany();
  console.log("All assets:", all.map(a => ({ id: a.id, filename: a.filename, path: a.path, thumbnailPath: a.thumbnailPath })));
}
check().catch(console.error).finally(() => prisma.$disconnect());
