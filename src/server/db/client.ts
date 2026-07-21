import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient across hot-reloads (Next.js dev re-imports modules).
 * Import this everywhere instead of `new PrismaClient()`.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
