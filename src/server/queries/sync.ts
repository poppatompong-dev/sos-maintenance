import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Offline sync bootstrap (doc 04, ADR 0004): each open work order with its asset
 * and the pinned version's FIELD GROUPS to render. Display-safe only — no item
 * kind, criticality, or critical-function key ever leaves the server here.
 */
export interface SyncFieldGroupMember {
  /** Opaque round-trip identifier (the item code); never displayed. */
  memberKey: string;
  label: string;
}

export interface SyncFieldGroup {
  /** Opaque identifier; never displayed. */
  key: string;
  label: string;
  help: string | null;
  order: number;
  required: boolean;
  reasonPolicy: string;
  photoPolicy: string;
  members: SyncFieldGroupMember[];
}

export interface SyncWorkOrder {
  id: string;
  code: string;
  kind: string;
  status: string;
  dueAt: Date | null;
  scheduledFor: Date | null;
  asset: { code: string; name: string; latitude: number; longitude: number };
  groups: SyncFieldGroup[];
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
          fieldGroups: {
            orderBy: { order: 'asc' },
            select: {
              key: true,
              label: true,
              helpText: true,
              order: true,
              required: true,
              reasonPolicy: true,
              photoPolicy: true,
              members: {
                orderBy: { memberOrder: 'asc' },
                select: { code: true, label: true },
              },
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
      groups: (w.checklistVersion?.fieldGroups ?? []).map((g) => ({
        key: g.key,
        label: g.label,
        help: g.helpText,
        order: g.order,
        required: g.required,
        reasonPolicy: g.reasonPolicy,
        photoPolicy: g.photoPolicy,
        members: g.members.map((m) => ({ memberKey: m.code, label: m.label })),
      })),
    })),
  };
}
