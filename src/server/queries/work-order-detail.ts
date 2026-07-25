import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Read query for a single work order (doc 08 §Interface). Includes the linked
 * fault + its latest repair evidence when the work order is corrective — the
 * Planner needs to see cause/fix/retest before accepting or rejecting it.
 */
export interface RepairEvidence {
  cause: string;
  fixDescription: string;
  changedParts: string | null;
  retestPassed: boolean | null;
  retestNote: string | null;
  createdAt: Date;
}

export interface WorkOrderDetail {
  code: string;
  kind: string;
  status: string;
  assetCode: string;
  assetName: string;
  dueAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  fault: {
    code: string;
    severity: string;
    status: string;
    symptom: string;
    latestRepair: RepairEvidence | null;
  } | null;
}

export async function getWorkOrderDetail(
  code: string,
  client: PrismaClient = defaultPrisma,
): Promise<WorkOrderDetail | null> {
  const wo = await client.workOrder.findUnique({
    where: { code },
    select: {
      code: true,
      kind: true,
      status: true,
      dueAt: true,
      scheduledFor: true,
      createdAt: true,
      asset: { select: { code: true, name: true } },
      fault: {
        select: {
          code: true,
          severity: true,
          status: true,
          symptom: true,
          repairActions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              cause: true,
              fixDescription: true,
              changedParts: true,
              retestPassed: true,
              retestNote: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!wo) return null;

  const latestRepair = wo.fault?.repairActions[0] ?? null;
  return {
    code: wo.code,
    kind: wo.kind,
    status: wo.status,
    assetCode: wo.asset.code,
    assetName: wo.asset.name,
    dueAt: wo.dueAt,
    scheduledFor: wo.scheduledFor,
    createdAt: wo.createdAt,
    fault: wo.fault
      ? {
          code: wo.fault.code,
          severity: wo.fault.severity,
          status: wo.fault.status,
          symptom: wo.fault.symptom,
          latestRepair,
        }
      : null,
  };
}
