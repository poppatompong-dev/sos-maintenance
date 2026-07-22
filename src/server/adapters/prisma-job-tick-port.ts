import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import type { JobTickPort, PendingNotification } from '../services/run-job-tick';

/** Prisma adapter for the job tick. */
export function createPrismaJobTickPort(
  client: PrismaClient = defaultPrisma,
): JobTickPort {
  return {
    async claimPendingNotifications(limit: number): Promise<PendingNotification[]> {
      const rows = await client.notification.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { id: true, channel: true },
      });
      return rows.map((r) => ({ id: r.id, channel: r.channel }));
    },

    async tryMarkNotificationSent(id: string, now: Date): Promise<boolean> {
      // Atomic compare-and-swap: the WHERE still requires status=PENDING, so of
      // two overlapping ticks exactly one update matches a row (count 1); the
      // other sees status already SENT and matches nothing (count 0). Postgres
      // serialises the concurrent updates on the row, so no double-send.
      const res = await client.notification.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: 'SENT', sentAt: now, attempts: { increment: 1 } },
      });
      return res.count === 1;
    },

    async countActiveAssets(): Promise<number> {
      return client.asset.count({ where: { retiredAt: null } });
    },
  };
}
