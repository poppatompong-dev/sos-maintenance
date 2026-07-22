import { evaluateReadiness, type ReadinessStatus } from '@/domain/readiness';
import { readinessRollup, type ReadinessRollup } from '@/domain/metrics';
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import { SOS_POLES } from '../../../prisma/seed-data/sos-poles';

/**
 * Readiness overview for the control-centre dashboard.
 *
 * Two sources with the SAME shape so the view layer never changes:
 *   - `getReadinessOverviewFromDb` — real data (Sprint 4+): stored per-asset
 *     `currentReadiness` (maintained by the submit-inspection service) plus the
 *     latest ReadinessSnapshot reason.
 *   - `getReadinessOverview` — seeded 27-pole registry computed with the real
 *     engine; used as an offline/dev fallback when no database is reachable.
 * `loadReadinessOverview` prefers the DB and falls back to seed, so `pnpm dev`
 * still renders the truthful first-run state (all poles UNKNOWN) without Docker.
 */
export interface PoleOverviewRow {
  code: string;
  name: string;
  status: ReadinessStatus;
  reason: string;
  longitude: number;
  latitude: number;
}

export interface ReadinessOverview {
  poles: PoleOverviewRow[];
  rollup: ReadinessRollup;
  generatedAt: Date;
  source: 'seed' | 'db';
}

/** Reason text an asset shows before any inspection exists (truthful UNKNOWN). */
function baselineUnknownReason(now: Date): string {
  const r = evaluateReadiness({
    now,
    baselineApproved: false,
    criticalChecks: [],
    openCriticalFault: false,
    openNonCriticalIssue: false,
    nextDueAt: null,
  });
  return r.reasons[0]?.message ?? '';
}

/** Pull the first reason message out of a stored ReadinessSnapshot.reasons JSON. */
function firstReasonMessage(reasons: unknown): string | null {
  if (Array.isArray(reasons) && reasons.length > 0) {
    const first = reasons[0];
    if (first && typeof first === 'object' && 'message' in first) {
      const msg = (first as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
  }
  return null;
}

/** Seed-backed overview (pure, no I/O). Every pole is truthfully UNKNOWN. */
export function getReadinessOverview(now: Date): ReadinessOverview {
  const poles: PoleOverviewRow[] = SOS_POLES.map((p) => {
    const result = evaluateReadiness({
      now,
      baselineApproved: false,
      criticalChecks: [],
      openCriticalFault: false,
      openNonCriticalIssue: false,
      nextDueAt: null,
    });
    return {
      code: p.code,
      name: p.name,
      status: result.status,
      reason: result.reasons[0]?.message ?? '',
      longitude: p.longitude,
      latitude: p.latitude,
    };
  });

  return {
    poles,
    rollup: readinessRollup(poles.map((p) => p.status)),
    generatedAt: now,
    source: 'seed',
  };
}

/** DB-backed overview: active assets + their stored readiness and latest reason. */
export async function getReadinessOverviewFromDb(
  now: Date,
  client: PrismaClient = defaultPrisma,
): Promise<ReadinessOverview> {
  const assets = await client.asset.findMany({
    where: { retiredAt: null, lifecycle: 'ACTIVE' },
    orderBy: { code: 'asc' },
    select: {
      code: true,
      name: true,
      currentReadiness: true,
      longitude: true,
      latitude: true,
      readinessSnapshots: {
        orderBy: { computedAt: 'desc' },
        take: 1,
        select: { reasons: true },
      },
    },
  });

  const fallbackReason = baselineUnknownReason(now);
  const poles: PoleOverviewRow[] = assets.map((a) => ({
    code: a.code,
    name: a.name,
    status: a.currentReadiness as ReadinessStatus,
    reason: firstReasonMessage(a.readinessSnapshots[0]?.reasons) ?? fallbackReason,
    longitude: a.longitude,
    latitude: a.latitude,
  }));

  return {
    poles,
    rollup: readinessRollup(poles.map((p) => p.status)),
    generatedAt: now,
    source: 'db',
  };
}

/** Prefer the database; fall back to the seed registry if the DB is unreachable. */
export async function loadReadinessOverview(now: Date): Promise<ReadinessOverview> {
  try {
    return await getReadinessOverviewFromDb(now);
  } catch (err) {
    console.warn(
      '[readiness-overview] DB unavailable, using seed fallback:',
      err instanceof Error ? err.message : err,
    );
    return getReadinessOverview(now);
  }
}
