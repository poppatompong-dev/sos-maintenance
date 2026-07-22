import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import { formatWorkOrderCode } from '@/domain/schedule';
import {
  type CreateBatchPersistInput,
  type PlanForSchedule,
  type ScheduleCreatePort,
} from '../services/create-schedule-batch';
import {
  BatchTransitionError,
  type ApplyBatchTransitionInput,
  type BatchTransitionPort,
  type ScheduleBatchState,
} from '../services/transition-schedule-batch';

/**
 * Prisma adapter for schedule-batch planning. Implements both the create port
 * (batch + generated work orders) and the transition port (approve / publish).
 */
export function createPrismaSchedulePort(
  client: PrismaClient = defaultPrisma,
): ScheduleCreatePort & BatchTransitionPort {
  return {
    async loadPlan(planId: string): Promise<PlanForSchedule | null> {
      const p = await client.maintenancePlan.findUnique({
        where: { id: planId },
        select: {
          id: true,
          kind: true,
          assetTypeKey: true,
          checklistVersionId: true,
          active: true,
        },
      });
      return p ?? null;
    },

    async createBatchWithWorkOrders(input: CreateBatchPersistInput) {
      return client.$transaction(async (tx) => {
        const year = input.now.getUTCFullYear();
        // Serialize WO-code allocation for this year across concurrent batch
        // creates: the transaction-scoped advisory lock makes the count→create
        // sequence atomic, so no two batches allocate overlapping codes (which
        // would otherwise race and hit the unique constraint). `year` is a
        // server-derived integer — safe to inline.
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(4242, ${year})`);

        const batch = await tx.scheduleBatch.create({
          data: {
            planId: input.planId,
            name: input.name,
            status: 'DRAFT',
            createdById: input.createdById,
          },
          select: { id: true },
        });

        const assets = await tx.asset.findMany({
          where: {
            retiredAt: null,
            lifecycle: 'ACTIVE',
            assetType: { key: input.assetTypeKey },
          },
          select: { id: true },
          orderBy: { code: 'asc' },
        });

        const base = await tx.workOrder.count({
          where: { code: { startsWith: `WO-${year}-` } },
        });

        for (let i = 0; i < assets.length; i++) {
          await tx.workOrder.create({
            data: {
              code: formatWorkOrderCode(year, base + i + 1),
              kind: input.kind,
              assetId: assets[i].id,
              planId: input.planId,
              scheduleBatchId: batch.id,
              checklistVersionId: input.checklistVersionId,
              status: 'DRAFT',
              scheduledFor: input.scheduledFor,
              dueAt: input.dueAt,
            },
          });
        }

        return { batchId: batch.id, workOrdersCreated: assets.length };
      });
    },

    async loadBatchById(id: string): Promise<ScheduleBatchState | null> {
      const b = await client.scheduleBatch.findUnique({
        where: { id },
        select: { id: true, status: true, version: true, createdById: true },
      });
      return b ?? null;
    },

    async applyBatchTransition(input: ApplyBatchTransitionInput) {
      return client.$transaction(async (tx) => {
        const updated = await tx.scheduleBatch.updateMany({
          where: { id: input.id, version: input.expectedVersion },
          data: {
            status: input.to,
            version: { increment: 1 },
            ...(input.to === 'APPROVED'
              ? { approvedAt: input.now, approverId: input.approverId ?? null }
              : {}),
            ...(input.to === 'PUBLISHED' ? { publishedAt: input.now } : {}),
          },
        });
        if (updated.count === 0) {
          throw new BatchTransitionError(
            'VERSION_CONFLICT',
            'ชุดงานถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่แล้วลองอีกครั้ง',
          );
        }

        // Publishing releases the batch's DRAFT work orders for assignment.
        if (input.to === 'PUBLISHED') {
          await tx.workOrder.updateMany({
            where: { scheduleBatchId: input.id, status: 'DRAFT' },
            data: { status: 'PUBLISHED' },
          });
        }

        const row = await tx.scheduleBatch.findUniqueOrThrow({
          where: { id: input.id },
          select: { status: true, version: true },
        });
        return { status: row.status, version: row.version };
      });
    },
  };
}
