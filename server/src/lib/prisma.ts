import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['warn', 'error'], // Reduced logging to prevent console spam
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;