import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Offline sync bootstrap (doc 04, ADR 0004): everything a technician needs to
 * work their assigned jobs offline — the open work orders assigned to them, each
 * with its asset and the exact checklist item definitions to render. The field
 * PWA caches this, then queues mutations via POST /api/inspections.
 */
export interface SyncChecklistItem {
  code: string;
  label: string;
  kind: string;
  criticality: string;
  criticalFunctionKey: string | null;
  requiresPhoto: boolean;
}

export interface SyncWorkOrder {
  id: string;
  code: string;
  kind: string;
  status: string;
  dueAt: Date | null;
  scheduledFor: Date | null;
  asset: { code: string; name: string; latitude: number; longitude: number };
  checklist: SyncChecklistItem[];
}

export interface SyncBootstrap {
  generatedAt: Date;
  workOrders: SyncWorkOrder[];
}

const OFFLINE_WO_STATUSES = ['PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'REOPENED'] as const;

export async function getSyncBootstrap(
  userId: string | null,
  now: Date,
  client: PrismaClient = defaultPrisma,
): Promise<SyncBootstrap> {
  const rows = await client.workOrder.findMany({
    where: {
      status: { in: [...OFFLINE_WO_STATUSES] },
      ...(userId ? { assignments: { some: { userId } } } : {}),
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      code: true,
      kind: true,
      status: true,
      dueAt: true,
      scheduledFor: true,
      asset: { select: { code: true, name: true, latitude: true, longitude: true } },
      checklistVersion: {
        select: {
          items: {
            orderBy: { order: 'asc' },
            select: {
              code: true,
              label: true,
              kind: true,
              criticality: true,
              criticalFunctionKey: true,
              requiresPhoto: true,
            },
          },
        },
      },
    },
  });

  return {
    generatedAt: now,
    workOrders: rows.map((w) => ({
      id: w.id,
      code: w.code,
      kind: w.kind,
      status: w.status,
      dueAt: w.dueAt,
      scheduledFor: w.scheduledFor,
      asset: w.asset,
      checklist: (w.checklistVersion?.items ?? []).map((it) => ({
        code: it.code,
        label: it.label,
        kind: it.kind,
        criticality: it.criticality,
        criticalFunctionKey: it.criticalFunctionKey,
        requiresPhoto: it.requiresPhoto,
      })),
    })),
  };
}
