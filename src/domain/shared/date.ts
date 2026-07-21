/**
 * Pure date helpers. All storage/comparison is done in UTC (system of record is
 * UTC per doc 04). Display-time conversion to Asia/Bangkok / พ.ศ. happens in the
 * presentation layer, never here.
 */

/** Return a new Date `days` after `date` (UTC-safe, non-mutating). */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** True when `a` is strictly after `b`. */
export function isAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

/** True when `a` is after or equal to `b`. */
export function isAfterOrEqual(a: Date, b: Date): boolean {
  return a.getTime() >= b.getTime();
}
