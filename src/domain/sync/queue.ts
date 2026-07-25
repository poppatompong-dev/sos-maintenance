/**
 * Pure state policy for the client-side offline mutation queue (doc 08
 * §Offline PWA — ยังไม่ซิงก์ / กำลังซิงก์ / ซิงก์ไม่สำเร็จ / ซิงก์แล้ว). The
 * queue itself lives in IndexedDB (browser-only, see `src/lib/offline-queue.ts`);
 * this module only decides what state a queued item moves to after an attempt,
 * so that decision is unit-testable without a browser.
 */
export type QueueEntryStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';

/**
 * What happened when the queue tried to send one entry.
 * - `success` / `already-applied`: the server has (or already had) the data —
 *   both clear the entry the same way (idempotent replay and "already
 *   transitioned past this point" are not failures).
 * - `network-error`: never reached the server — retry later, no data lost,
 *   never surfaced as a failure to the technician.
 * - `rejected`: the server said no (validation, conflict). Retrying
 *   unmodified would fail again, so this does NOT auto-retry — it must stay
 *   visible until a person looks at it (never silently dropped).
 */
export type AttemptOutcome =
  | { kind: 'success' }
  | { kind: 'already-applied' }
  | { kind: 'network-error' }
  | { kind: 'rejected'; message: string };

export interface QueueAttemptResult {
  status: QueueEntryStatus;
  attempts: number;
  lastError: string | null;
}

/** Next entry state after one send attempt. Pure — no IO, no timers. */
export function nextQueueState(
  entry: { attempts: number },
  outcome: AttemptOutcome,
): QueueAttemptResult {
  const attempts = entry.attempts + 1;
  switch (outcome.kind) {
    case 'success':
    case 'already-applied':
      return { status: 'SYNCED', attempts, lastError: null };
    case 'network-error':
      return { status: 'PENDING', attempts, lastError: null };
    case 'rejected':
      return { status: 'FAILED', attempts, lastError: outcome.message };
  }
}

/** True once every entry is synced (queue drained clean) — never counts FAILED as done. */
export function isQueueClear(statuses: readonly QueueEntryStatus[]): boolean {
  return statuses.every((s) => s === 'SYNCED');
}
