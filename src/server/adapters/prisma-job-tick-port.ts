import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import type { ReadinessReason, ReadinessStatus } from '@/domain/readiness';
import type {
  AssetRecomputeCandidate,
  JobTickPort,
  PendingNotification,
} from '../services/run-job-tick';
import { loadAssetReadinessFacts } from './readiness-facts-loader';

/** Prisma adapter for the job tick (includes RDY-06 scheduled readiness recompute). */
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

    async loadActiveAssetsForRecompute(): Promise<AssetRecomputeCandidate[]> {
      const assets = await client.asset.findMany({
        where: { retiredAt: null },
        select: {
          id: true,
          code: true,
          baselineApproved: true,
          retiredAt: true,
          currentReadiness: true,
          components: {
            where: { criticality: 'CRITICAL', retiredAt: null },
            select: { key: true, name: true },
            orderBy: { key: 'asc' },
          },
          readinessSnapshots: {
            orderBy: { computedAt: 'desc' },
            take: 1,
            select: { status: true, reasons: true },
          },
        },
      });

      const candidates: AssetRecomputeCandidate[] = [];
      for (const asset of assets) {
        const facts = await loadAssetReadinessFacts(client, asset.id, asset.components);
        const latestSnapshot = asset.readinessSnapshots[0];
        const currentReadinessStatus =
          (asset.currentReadiness as ReadinessStatus | null) ??
          (latestSnapshot?.status as ReadinessStatus | null) ??
          null;
        const currentReadinessReasons =
          (latestSnapshot?.reasons as unknown as ReadinessReason[] | null) ?? null;

        candidates.push({
          id: asset.id,
          code: asset.code,
          baselineApproved: asset.baselineApproved,
          retired: asset.retiredAt !== null,
          currentReadinessStatus,
          currentReadinessReasons,
          readinessFacts: facts,
        });
      }

      return candidates;
    },

    async persistReadinessRecompute(
      assetId: string,
      status: ReadinessStatus,
      reasons: ReadinessReason[],
      now: Date,
    ): Promise<void> {
      await client.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: assetId },
          data: {
            currentReadiness: status,
            version: { increment: 1 },
          },
        });

        await tx.readinessSnapshot.create({
          data: {
            assetId,
            status,
            reasons: reasons as unknown as Prisma.InputJsonValue,
            trigger: 'RECONCILIATION',
            computedAt: now,
          },
        });
      });
    },
  };
}
