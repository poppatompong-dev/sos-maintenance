import type { FaultStatus, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';

/**
 * Read query for the fault list (doc 08 §Interface). Defaults to OPEN-ish faults
 * (anything not yet resolved); an explicit status filter overrides that. Newest
 * detection first.
 */
export interface FaultListRow {
  code: string;
  assetCode: string;
  severity: string;
  status: string;
  symptom: string;
  detectedAt: Date;
  resolvedAt: Date | null;
}

const UNRESOLVED_STATUSES: FaultStatus[] = [
  'OPEN',
  'IN_REPAIR',
  'RETEST',
  'REOPENED',
];

export async function listFaults(
  filter: { status?: FaultStatus } = {},
  client: PrismaClient = defaultPrisma,
): Promise<FaultListRow[]> {
  const rows = await client.fault.findMany({
    where: filter.status
      ? { status: filter.status }
      : { status: { in: UNRESOLVED_STATUSES } },
    orderBy: { detectedAt: 'desc' },
    select: {
      code: true,
      severity: true,
      status: true,
      symptom: true,
      detectedAt: true,
      resolvedAt: true,
      asset: { select: { code: true } },
    },
  });
  return rows.map((f) => ({
    code: f.code,
    assetCode: f.asset.code,
    severity: f.severity,
    status: f.status,
    symptom: f.symptom,
    detectedAt: f.detectedAt,
    resolvedAt: f.resolvedAt,
  }));
}
