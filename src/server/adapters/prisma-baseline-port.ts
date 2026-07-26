import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import type { CriticalCheckResult } from '@/domain/readiness';
import {
  BaselineApprovalError,
  type ApproveBaselinePort,
  type BaselineAssetState,
  type PersistBaselineApprovalInput,
} from '../services/approve-baseline';

/**
 * Prisma adapter for baseline approval (ASSET-06).
 *
 * Loading is the interesting half: the service needs the *evidence* (the most
 * recent INITIAL_SURVEY work order plus who submitted it) and the readiness
 * facts, so that approving recomputes a truthful status instead of assuming
 * READY. Persisting is a single transaction — the approval fields, the
 * immutable snapshot, and the denormalised status move together or not at all.
 */

const OPEN_FAULT_STATUSES = ['OPEN', 'IN_REPAIR', 'RETEST', 'REOPENED'] as const;

/** Work-order states that still expect to be worked (for "next due"). */
const LIVE_WORK_ORDER_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'REJECTED',
  'REOPENED',
] as const;

/** Latest stored result per required critical function; UNKNOWN when absent. */
function toCriticalChecks(
  required: { key: string; label: string }[],
  latestByKey: Map<string, { result: string; observedAt: Date }>,
): CriticalCheckResult[] {
  return required.map((fn) => {
    const latest = latestByKey.get(fn.key);
    // NA is not evidence that a critical function works — treat it as UNKNOWN
    // rather than quietly letting the pole pass.
    const result =
      latest?.result === 'PASS' || latest?.result === 'FAIL'
        ? (latest.result as 'PASS' | 'FAIL')
        : 'UNKNOWN';
    return {
      key: fn.key,
      label: fn.label,
      result,
      observedAt: latest?.observedAt ?? null,
    };
  });
}

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
          faults: {
            where: { status: { in: [...OPEN_FAULT_STATUSES] } },
            select: { severity: true },
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

      const required = asset.components.map((c) => ({ key: c.key, label: c.name }));

      // Latest PASS/FAIL per required critical function, across every work
      // order on this asset.
      const latestByKey = new Map<string, { result: string; observedAt: Date }>();
      if (required.length > 0) {
        const responses = await client.checklistResponse.findMany({
          where: {
            workOrder: { assetId: asset.id },
            item: { criticalFunctionKey: { in: required.map((r) => r.key) } },
          },
          orderBy: { observedAt: 'desc' },
          select: {
            result: true,
            observedAt: true,
            item: { select: { criticalFunctionKey: true } },
          },
        });
        for (const r of responses) {
          const key = r.item.criticalFunctionKey;
          if (key && !latestByKey.has(key)) {
            latestByKey.set(key, { result: r.result, observedAt: r.observedAt });
          }
        }
      }

      // Next scheduled due date across work orders that are still live.
      const nextDue = await client.workOrder.findFirst({
        where: {
          assetId: asset.id,
          status: { in: [...LIVE_WORK_ORDER_STATUSES] },
          dueAt: { not: null },
        },
        orderBy: { dueAt: 'asc' },
        select: { dueAt: true },
      });

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
        readinessFacts: {
          criticalChecks: toCriticalChecks(required, latestByKey),
          openCriticalFault: asset.faults.some((f) => f.severity === 'CRITICAL'),
          openNonCriticalIssue: asset.faults.some((f) => f.severity === 'NON_CRITICAL'),
          nextDueAt: nextDue?.dueAt ?? null,
        },
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
