import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import {
  BaselineApprovalError,
  type ApproveBaselinePort,
  type BaselineAssetState,
  type PersistBaselineApprovalInput,
} from '../services/approve-baseline';
import { loadAssetReadinessFacts } from './readiness-facts-loader';

/**
 * Prisma adapter for baseline approval (ASSET-06).
 *
 * Loading is the interesting half: the service needs the *evidence* (the most
 * recent INITIAL_SURVEY work order plus who submitted it) and the readiness
 * facts, so that approving recomputes a truthful status instead of assuming
 * READY. Persisting is a single transaction — the approval fields, the
 * immutable snapshot, and the denormalised status move together or not at all.
 */

export function createPrismaBaselinePort(
  client: PrismaClient = defaultPrisma,
): ApproveBaselinePort {
  return {
    async loadByCode(code: string): Promise<BaselineAssetState | null> {
      const asset = await client.asset.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          baselineApproved: true,
          retiredAt: true,
          version: true,
          // Critical functions come from the asset's flagged-critical
          // components, not a hard-coded list (doc 07).
          components: {
            where: { criticality: 'CRITICAL', retiredAt: null },
            select: { key: true, name: true },
            orderBy: { key: 'asc' },
          },
          workOrders: {
            where: { kind: 'INITIAL_SURVEY' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              kind: true,
              workLogs: {
                where: { toStatus: 'SUBMITTED' },
                orderBy: { occurredAt: 'desc' },
                take: 1,
                select: { actorId: true },
              },
            },
          },
        },
      });
      if (!asset) return null;

      const readinessFacts = await loadAssetReadinessFacts(client, asset.id, asset.components);
      const survey = asset.workOrders[0];

      return {
        assetId: asset.id,
        code: asset.code,
        baselineApproved: asset.baselineApproved,
        retired: asset.retiredAt !== null,
        version: asset.version,
        survey: survey
          ? {
              workOrderId: survey.id,
              kind: survey.kind,
              status: survey.status,
              submittedByUserId: survey.workLogs[0]?.actorId ?? undefined,
            }
          : undefined,
        readinessFacts,
      };
    },

    async persist(input: PersistBaselineApprovalInput): Promise<void> {
      await client.$transaction(async (tx) => {
        // Optimistic concurrency + a second guard against double approval: the
        // update only matches while the row is still unapproved at the version
        // the decision was made on.
        const updated = await tx.asset.updateMany({
          where: {
            id: input.assetId,
            version: input.expectedVersion,
            baselineApproved: false,
          },
          data: {
            baselineApproved: true,
            baselineApprovedAt: input.approvedAt,
            baselineApproverId: input.approverUserId,
            currentReadiness: input.readiness.status,
            version: { increment: 1 },
          },
        });
        if (updated.count === 0) {
          throw new BaselineApprovalError(
            'CONCURRENT_UPDATE',
            'จุดติดตั้งนี้ถูกแก้ไขโดยผู้ใช้อื่น กรุณาลองใหม่',
          );
        }

        // Immutable readiness snapshot — the approval is a readiness event.
        await tx.readinessSnapshot.create({
          data: {
            assetId: input.assetId,
            status: input.readiness.status,
            reasons: input.readiness.reasons as unknown as Prisma.InputJsonValue,
            trigger: 'BASELINE_APPROVED',
            computedAt: input.approvedAt,
          },
        });
      });
    },
  };
}
