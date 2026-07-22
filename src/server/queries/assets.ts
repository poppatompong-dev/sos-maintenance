import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import type { ReadinessStatus } from '@/domain/readiness';

/**
 * Read queries for the asset registry (doc 08 §Interface). Thin DB reads shaped
 * for the API/UI; all business rules stay in the domain. Retired assets are
 * excluded by default.
 */

export interface AssetListRow {
  code: string;
  name: string;
  status: ReadinessStatus;
  lifecycle: string;
  longitude: number;
  latitude: number;
  updatedAt: Date;
}

export async function listAssets(
  client: PrismaClient = defaultPrisma,
): Promise<AssetListRow[]> {
  const rows = await client.asset.findMany({
    where: { retiredAt: null },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      currentReadiness: true,
      lifecycle: true,
      longitude: true,
      latitude: true,
      updatedAt: true,
    },
  });
  return rows.map((a) => ({
    code: a.code,
    name: a.name,
    status: a.currentReadiness as ReadinessStatus,
    lifecycle: a.lifecycle,
    longitude: a.longitude,
    latitude: a.latitude,
    updatedAt: a.updatedAt,
  }));
}

export interface AssetDetail {
  code: string;
  name: string;
  status: ReadinessStatus;
  lifecycle: string;
  baselineApproved: boolean;
  longitude: number;
  latitude: number;
  components: {
    key: string;
    name: string;
    criticality: string;
    status: string;
  }[];
  latestReadiness: {
    status: ReadinessStatus;
    reasons: unknown;
    trigger: string;
    computedAt: Date;
  } | null;
  openFaults: {
    code: string;
    severity: string;
    status: string;
    symptom: string;
    detectedAt: Date;
  }[];
  activeWorkOrders: {
    code: string;
    kind: string;
    status: string;
    dueAt: Date | null;
    scheduledFor: Date | null;
  }[];
}

const OPEN_FAULT_STATUSES = ['OPEN', 'IN_REPAIR', 'RETEST', 'REOPENED'] as const;
const ACTIVE_WO_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'REOPENED',
] as const;

/** Full asset detail by business code (EP01..), or null when not found. */
export async function getAssetDetail(
  code: string,
  client: PrismaClient = defaultPrisma,
): Promise<AssetDetail | null> {
  const a = await client.asset.findUnique({
    where: { code },
    select: {
      code: true,
      name: true,
      currentReadiness: true,
      lifecycle: true,
      baselineApproved: true,
      longitude: true,
      latitude: true,
      components: {
        where: { retiredAt: null },
        orderBy: { key: 'asc' },
        select: { key: true, name: true, criticality: true, status: true },
      },
      readinessSnapshots: {
        orderBy: { computedAt: 'desc' },
        take: 1,
        select: { status: true, reasons: true, trigger: true, computedAt: true },
      },
      faults: {
        where: { status: { in: [...OPEN_FAULT_STATUSES] } },
        orderBy: { detectedAt: 'desc' },
        select: { code: true, severity: true, status: true, symptom: true, detectedAt: true },
      },
      workOrders: {
        where: { status: { in: [...ACTIVE_WO_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        select: { code: true, kind: true, status: true, dueAt: true, scheduledFor: true },
      },
    },
  });

  if (!a) return null;
  const snap = a.readinessSnapshots[0] ?? null;
  return {
    code: a.code,
    name: a.name,
    status: a.currentReadiness as ReadinessStatus,
    lifecycle: a.lifecycle,
    baselineApproved: a.baselineApproved,
    longitude: a.longitude,
    latitude: a.latitude,
    components: a.components,
    latestReadiness: snap
      ? {
          status: snap.status as ReadinessStatus,
          reasons: snap.reasons,
          trigger: snap.trigger,
          computedAt: snap.computedAt,
        }
      : null,
    openFaults: a.faults,
    activeWorkOrders: a.workOrders,
  };
}
