import { nextQueueState, type AttemptOutcome, type QueueEntryStatus } from '@/domain/sync/queue';
import {
  listQueue,
  offlineQueueSupported,
  removeQueueEntry,
  updateQueueEntry,
  type QueuedSubmission,
} from './offline-queue';

/**
 * Replay one queued submission: the checklist envelope, then the follow-up
 * `SUBMITTED` transition — same two calls `InspectionForm` makes when online
 * (`src/components/TodayWorkspace.tsx`), so a drained entry produces exactly
 * the same server state as a normal online submit.
 */
async function attemptSubmission(entry: QueuedSubmission): Promise<AttemptOutcome> {
  try {
    const inspectionRes = await fetch('/api/inspections', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry.envelope),
    });
    if (!inspectionRes.ok) {
      const body = (await inspectionRes.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (inspectionRes.status >= 400 && inspectionRes.status < 500) {
        return { kind: 'rejected', message: body?.message ?? body?.error ?? `ส่งผลตรวจไม่สำเร็จ (${inspectionRes.status})` };
      }
      return { kind: 'network-error' }; // 5xx — treat as transient, retry later
    }

    const transitionRes = await fetch(`/api/work-orders/${encodeURIComponent(entry.workOrderCode)}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to: 'SUBMITTED' }),
    });
    if (transitionRes.ok) return { kind: 'success' };

    const body = (await transitionRes.json().catch(() => null)) as { message?: string; error?: string } | null;
    if (transitionRes.status === 409 && body?.error === 'TRANSITION_NOT_ALLOWED') {
      // Inspection already landed on an earlier drain attempt; the work order
      // is already past SUBMITTED. Nothing left to do — not a failure.
      return { kind: 'already-applied' };
    }
    if (transitionRes.status >= 400 && transitionRes.status < 500) {
      return { kind: 'rejected', message: body?.message ?? body?.error ?? `เปลี่ยนสถานะไม่สำเร็จ (${transitionRes.status})` };
    }
    return { kind: 'network-error' };
  } catch (cause) {
    if (cause instanceof TypeError) return { kind: 'network-error' };
    throw cause;
  }
}

/**
 * Replay queued entries matching `statuses`. Defaults to `PENDING` only —
 * `FAILED` entries were explicitly rejected by the server and must NOT be
 * silently auto-retried (see `nextQueueState`); retrying those requires an
 * explicit user action, which passes `['FAILED']` here.
 */
export async function drainOfflineQueue(statuses: QueueEntryStatus[] = ['PENDING']): Promise<void> {
  if (!offlineQueueSupported()) return;
  const queue = await listQueue();
  for (const entry of queue.filter((e) => statuses.includes(e.status))) {
    await updateQueueEntry(entry.id, { status: 'SYNCING' });
    let outcome: AttemptOutcome;
    try {
      outcome = await attemptSubmission(entry);
    } catch {
      outcome = { kind: 'network-error' };
    }
    const next = nextQueueState(entry, outcome);
    if (next.status === 'SYNCED') {
      await removeQueueEntry(entry.id);
    } else {
      await updateQueueEntry(entry.id, { status: next.status, attempts: next.attempts, lastError: next.lastError });
    }
  }
}
