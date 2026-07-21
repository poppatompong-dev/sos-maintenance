import { evaluateReadiness, type ReadinessStatus } from '@/domain/readiness';
import { readinessRollup, type ReadinessRollup } from '@/domain/metrics';
import { SOS_POLES } from '../../../prisma/seed-data/sos-poles';

/**
 * Readiness overview for the control-centre dashboard.
 *
 * TEMPORARY DATA SOURCE: until the Prisma repositories land (needs Docker/DB),
 * this reads the seeded 27-pole registry and computes each pole's readiness with
 * the real engine. With no approved Initial Survey yet, every pole is truthfully
 * UNKNOWN — this is the correct first-run state, not placeholder data. Swap the
 * registry read for a DB query in Sprint 4 without touching the view layer.
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
  source: 'seed';
}

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
