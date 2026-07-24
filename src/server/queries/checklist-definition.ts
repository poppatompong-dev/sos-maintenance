import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/** Server-authoritative pinned-version definition used to canonicalize a submit. */
export interface PinnedGroupMember {
  memberKey: string; // item code
  label: string;
}
export interface PinnedGroup {
  key: string;
  required: boolean;
  members: PinnedGroupMember[];
}
export interface PinnedItem {
  code: string;
  label: string;
  criticality: 'CRITICAL' | 'NON_CRITICAL';
  criticalFunctionKey: string | null;
}
export interface PinnedChecklistDefinition {
  versionId: string;
  groups: PinnedGroup[];
  items: PinnedItem[];
  /** Ungrouped item that carries the general note (lowest order), or null. */
  generalNoteItemCode: string | null;
}

export async function loadPinnedChecklistDefinition(
  workOrderId: string,
  client: PrismaClient = defaultPrisma,
): Promise<PinnedChecklistDefinition | null> {
  const wo = await client.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      checklistVersion: {
        select: {
          id: true,
          fieldGroups: {
            orderBy: { order: 'asc' },
            select: {
              key: true,
              required: true,
              members: {
                orderBy: { memberOrder: 'asc' },
                select: { code: true, label: true },
              },
            },
          },
          items: {
            orderBy: { order: 'asc' },
            select: {
              code: true,
              label: true,
              criticality: true,
              criticalFunctionKey: true,
              fieldGroupId: true,
            },
          },
        },
      },
    },
  });

  const version = wo?.checklistVersion;
  if (!version) return null;

  const ungrouped = version.items.filter((it) => it.fieldGroupId === null);

  return {
    versionId: version.id,
    groups: version.fieldGroups.map((g) => ({
      key: g.key,
      required: g.required,
      members: g.members.map((m) => ({ memberKey: m.code, label: m.label })),
    })),
    items: version.items.map((it) => ({
      code: it.code,
      label: it.label,
      criticality: it.criticality,
      criticalFunctionKey: it.criticalFunctionKey,
    })),
    generalNoteItemCode: ungrouped.length > 0 ? ungrouped[0].code : null,
  };
}
