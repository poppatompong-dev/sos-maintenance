import type { ReadinessStatus } from '../readiness';

/**
 * Single source of metric definitions (doc 08): dashboard, PDF and Excel all read
 * from here so their numbers can never disagree. Pure functions over already-
 * fetched rows — no DB access.
 */

/** Milliseconds between two instants, or null if either is missing/negative. */
export function durationMs(from?: Date | null, to?: Date | null): number | null {
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return ms >= 0 ? ms : null;
}

export interface WorkOrderTimes {
  detectedAt?: Date | null;
  acknowledgedAt?: Date | null;
  repairedAt?: Date | null;
  closedAt?: Date | null;
}

/** Time to acknowledge: detected → acknowledged. */
export function timeToAcknowledgeMs(t: WorkOrderTimes): number | null {
  return durationMs(t.detectedAt, t.acknowledgedAt);
}

/** Time to resolve (MTTR basis): detected → closed/accepted. */
export function timeToResolveMs(t: WorkOrderTimes): number | null {
  return durationMs(t.detectedAt, t.closedAt);
}

export interface DurationSummary {
  count: number;
  meanMs: number | null;
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
}

/** Summarise a set of durations, ignoring nulls. */
export function summarize(values: readonly (number | null)[]): DurationSummary {
  const nums = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  if (nums.length === 0) {
    return { count: 0, meanMs: null, medianMs: null, minMs: null, maxMs: null };
  }
  const sum = nums.reduce((a, b) => a + b, 0);
  const mid = Math.floor(nums.length / 2);
  const median =
    nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
  return {
    count: nums.length,
    meanMs: sum / nums.length,
    medianMs: median,
    minMs: nums[0],
    maxMs: nums[nums.length - 1],
  };
}

export interface ReadinessRollup {
  total: number;
  counts: Record<ReadinessStatus, number>;
  /** Percentage per status, rounded to 1 decimal, summing to ~100. */
  percentages: Record<ReadinessStatus, number>;
}

const ZERO: Record<ReadinessStatus, number> = {
  READY: 0,
  WATCH: 0,
  DOWN: 0,
  UNKNOWN: 0,
};

/** Count assets by readiness status with percentages (dashboard headline). */
export function readinessRollup(
  statuses: readonly ReadinessStatus[],
): ReadinessRollup {
  const counts = { ...ZERO };
  for (const s of statuses) counts[s] += 1;
  const total = statuses.length;
  const pct = { ...ZERO };
  if (total > 0) {
    (Object.keys(counts) as ReadinessStatus[]).forEach((k) => {
      pct[k] = Math.round((counts[k] / total) * 1000) / 10;
    });
  }
  return { total, counts, percentages: pct };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Human Thai duration, at most two units: "2 ชม. 15 นาที", "1 วัน 3 ชม.". */
export function formatDurationThai(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < MINUTE) return 'น้อยกว่า 1 นาที';
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return `${days} วัน${hours > 0 ? ` ${hours} ชม.` : ''}`;
  if (hours > 0) return `${hours} ชม.${minutes > 0 ? ` ${minutes} นาที` : ''}`;
  return `${minutes} นาที`;
}
