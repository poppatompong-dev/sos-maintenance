import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import { INTERNAL_ACTOR_ID } from '../auth/session';
import { allCriticalPassed, type EvaluatedResponse } from '@/domain/checklist';
import type { WorkOrderStatus } from '@/domain/work/types';
import {
  WorkOrderTransitionError,
  type ApplyTransitionInput,
  type WorkOrderState,
  type WorkOrderTransitionPort,
} from '../services/transition-work-order';

/**
 * Prisma adapter for work-order transitions. Persists the new status with an
 * optimistic-concurrency guard and appends an immutable WorkLog row; MTTA/MTTR
 * timestamps are stamped on the transitions that own them.
 */

const TIMESTAMP_FIELD: Partial<Record<WorkOrderStatus, keyof Prisma.WorkOrderUpdateInput>> = {
  IN_PROGRESS: 'startedAt',
  SUBMITTED: 'submittedAt',
  CLOSED: 'closedAt',
  REJECTED: 'reviewedAt',
};

export function createPrismaWorkOrderPort(
  client: PrismaClient = defaultPrisma,
): WorkOrderTransitionPort {
  return {
    async loadByCode(code: string): Promise<WorkOrderState | null> {
      const wo = await client.workOrder.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          status: true,
          kind: true,
          version: true,
          workLogs: {
            where: { toStatus: 'SUBMITTED' },
            orderBy: { occurredAt: 'desc' },
            take: 1,
            select: { actorId: true },
          },
          responses: {
            select: {
              result: true,
              item: { select: { code: true, label: true, criticality: true } },
            },
          },
        },
      });
      if (!wo) return null;

      const responses: EvaluatedResponse[] = wo.responses.map((r) => ({
        itemCode: r.item.code,
        label: r.item.label,
        result: r.result,
        criticality: r.item.criticality,
      }));

      return {
        id: wo.id,
        code: wo.code,
        status: wo.status,
        kind: wo.kind,
        version: wo.version,
        submittedByUserId: wo.workLogs[0]?.actorId ?? undefined,
        allChecklistPassed:
          responses.length > 0 ? allCriticalPassed(responses) : undefined,
      };
    },

    async applyTransition(input: ApplyTransitionInput) {
      return client.$transaction(async (tx) => {
        const data: Prisma.WorkOrderUpdateInput = {
          status: input.to,
          version: { increment: 1 },
        };
        const tsField = TIMESTAMP_FIELD[input.to];
        if (tsField) (data as Record<string, unknown>)[tsField] = input.now;
        if (input.to === 'CLOSED') data.reviewedAt = input.now;

        // Optimistic concurrency: only update the row still at expectedVersion.
        const updated = await tx.workOrder.updateMany({
          where: { id: input.workOrderId, version: input.expectedVersion },
          data,
        });
        if (updated.count === 0) {
          throw new WorkOrderTransitionError(
            'VERSION_CONFLICT',
            'ใบงานถูกแก้ไขโดยผู้อื่น กรุณาโหลดใหม่แล้วลองอีกครั้ง',
          );
        }

        await tx.workLog.create({
          data: {
            workOrderId: input.workOrderId,
            fromStatus: input.from,
            toStatus: input.to,
            // Internal no-login mode has no real user row. Keep the immutable
            // work log, but leave the optional FK null rather than inventing a
            // database identity.
            actorId: input.actorUserId === INTERNAL_ACTOR_ID ? null : input.actorUserId,
            note: input.note ?? null,
            occurredAt: input.now,
          },
        });

        const row = await tx.workOrder.findUniqueOrThrow({
          where: { id: input.workOrderId },
          select: { status: true, version: true },
        });
        return { status: row.status, version: row.version };
      });
    },
  };
}
