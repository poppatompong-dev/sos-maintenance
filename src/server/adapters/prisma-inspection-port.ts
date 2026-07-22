import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import {
  InspectionError,
  type AssetForInspection,
  type InspectionPort,
  type PersistInspectionInput,
} from '../services/submit-inspection';

/**
 * Prisma adapter for the `InspectionPort` the submit-inspection service depends
 * on. This is the Sprint 4 vertical slice: the same pure service that unit tests
 * drive with an in-memory port now runs against Postgres — no domain change.
 *
 * Idempotency: the service short-circuits via `isMutationProcessed`, so `persist`
 * runs at most once per envelope. We record the envelope `mutationId` on the
 * first ChecklistResponse row (its `clientMutationId` column is UNIQUE), which is
 * both the write and the idempotency marker — a replay finds it and no-ops.
 */

const OPEN_FAULT_STATUSES = ['OPEN', 'IN_REPAIR', 'RETEST', 'REOPENED'] as const;

export function createPrismaInspectionPort(
  client: PrismaClient = defaultPrisma,
): InspectionPort {
  return {
    async isMutationProcessed(mutationId: string): Promise<boolean> {
      const existing = await client.checklistResponse.findFirst({
        where: { clientMutationId: mutationId },
        select: { id: true },
      });
      return existing !== null;
    },

    async loadAssetForWorkOrder(
      workOrderId: string,
    ): Promise<AssetForInspection | null> {
      const wo = await client.workOrder.findUnique({
        where: { id: workOrderId },
        select: {
          dueAt: true,
          asset: {
            select: {
              id: true,
              code: true,
              latitude: true,
              longitude: true,
              baselineApproved: true,
              // Read critical functions from the asset's flagged-critical
              // components (doc 07: the list may change over time), not a hard-
              // coded constant.
              components: {
                where: { criticality: 'CRITICAL', retiredAt: null },
                select: { key: true, name: true },
                orderBy: { key: 'asc' },
              },
              faults: {
                where: {
                  severity: 'NON_CRITICAL',
                  status: { in: [...OPEN_FAULT_STATUSES] },
                },
                select: { id: true },
              },
            },
          },
        },
      });

      if (!wo?.asset) return null;
      const a = wo.asset;
      return {
        assetId: a.id,
        code: a.code,
        lat: a.latitude,
        lng: a.longitude,
        baselineApproved: a.baselineApproved,
        requiredCriticalFunctions: a.components.map((c) => ({
          key: c.key,
          label: c.name,
        })),
        nextDueAt: wo.dueAt ?? null,
        openNonCriticalIssue: a.faults.length > 0,
      };
    },

    async persist(input: PersistInspectionInput): Promise<void> {
      await client.$transaction(async (tx) => {
        const wo = await tx.workOrder.findUnique({
          where: { id: input.workOrderId },
          select: { id: true, checklistVersionId: true },
        });
        if (!wo) {
          throw new InspectionError('WORKORDER_NOT_FOUND', 'ไม่พบใบงาน');
        }
        if (!wo.checklistVersionId) {
          throw new InspectionError(
            'NO_CHECKLIST_VERSION',
            'ใบงานยังไม่ผูกเวอร์ชันเช็คลิสต์',
          );
        }

        const items = await tx.checklistItem.findMany({
          where: { versionId: wo.checklistVersionId },
          select: { id: true, code: true },
        });
        const itemIdByCode = new Map(items.map((i) => [i.code, i.id]));
        const observedAt = input.readiness.evaluatedAt;

        // 1. Checklist responses (evidence). First row carries the mutation id.
        for (let i = 0; i < input.responses.length; i++) {
          const r = input.responses[i];
          const itemId = itemIdByCode.get(r.itemCode);
          if (!itemId) {
            throw new InspectionError(
              'ITEM_NOT_FOUND',
              `ไม่พบรายการเช็คลิสต์ ${r.itemCode} ในเวอร์ชันของใบงาน`,
            );
          }
          await tx.checklistResponse.create({
            data: {
              workOrderId: wo.id,
              itemId,
              checklistVersionId: wo.checklistVersionId,
              result: r.result,
              capturedLat: input.gps.lat,
              capturedLng: input.gps.lng,
              distanceMeters: input.gps.distanceMeters,
              locationException: input.gps.isException,
              reviewFlag: input.gps.reviewFlag,
              clientMutationId: i === 0 ? input.mutationId : null,
              observedAt,
            },
          });
        }

        // 2. Faults from failed items (append; corrective WOs are Sprint 6).
        if (input.faults.length > 0) {
          const year = observedAt.getUTCFullYear();
          const base = await tx.fault.count();
          for (let i = 0; i < input.faults.length; i++) {
            const f = input.faults[i];
            await tx.fault.create({
              data: {
                code: `FLT-${year}-${String(base + i + 1).padStart(4, '0')}`,
                assetId: input.assetId,
                originWorkOrderId: wo.id,
                severity: f.severity,
                status: 'OPEN',
                symptom: f.symptom,
                sourceRef: f.sourceRef,
                detectedAt: observedAt,
              },
            });
          }
        }

        // 3. Immutable readiness snapshot + denormalised current status.
        await tx.readinessSnapshot.create({
          data: {
            assetId: input.assetId,
            status: input.readiness.status,
            reasons: input.readiness.reasons as unknown as Prisma.InputJsonValue,
            trigger: 'CHECKLIST_SUBMIT',
            computedAt: observedAt,
          },
        });
        await tx.asset.update({
          where: { id: input.assetId },
          data: {
            currentReadiness: input.readiness.status,
            version: { increment: 1 },
          },
        });
      });
    },
  };
}
