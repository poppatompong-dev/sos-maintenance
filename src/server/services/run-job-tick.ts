/**
 * Job tick (doc 03, serverless variant). The background worker's periodic jobs,
 * runnable as a single on-demand pass so a cron trigger (Vercel Cron / GitHub
 * Actions) can drive them without an always-on process. Idempotent and bounded:
 * each tick claims a limited batch, so repeated ticks converge without piling up.
 *
 * V1 jobs:
 *  - notification dispatch: PENDING in-app notifications are delivered (marked
 *    SENT). Email notifications are DEFERRED until the SMTP transport lands
 *    (Nodemailer, later) — left PENDING, never dropped.
 *  - readiness reconciliation: reports assets in scope (full recompute is a later
 *    sprint; kept as a scope signal for observability).
 */
export interface PendingNotification {
  id: string;
  channel: string;
}

export interface JobTickPort {
  /** Candidate PENDING notifications (may overlap between concurrent ticks). */
  claimPendingNotifications(limit: number): Promise<PendingNotification[]>;
  /**
   * Atomically claim + send one notification: flip PENDING→SENT conditionally.
   * Returns true only for the tick that won the claim (the compare-and-swap that
   * actually flipped the row); false if another tick already sent it. This is
   * what makes overlapping ticks safe — a notification is sent at most once.
   */
  tryMarkNotificationSent(id: string, now: Date): Promise<boolean>;
  countActiveAssets(): Promise<number>;
}

export interface JobTickResult {
  ranAt: Date;
  notificationsSent: number;
  notificationsDeferred: number;
  assetsInScope: number;
}

export interface JobTickOptions {
  now: Date;
  /** Max notifications to process this tick (keeps each run bounded). */
  limit?: number;
}

export async function runJobTick(
  port: JobTickPort,
  opts: JobTickOptions,
): Promise<JobTickResult> {
  const limit = opts.limit ?? 50;
  const pending = await port.claimPendingNotifications(limit);

  let sent = 0;
  let deferred = 0;
  for (const n of pending) {
    if (n.channel === 'IN_APP') {
      // Conditional claim: only count as sent if THIS tick flipped the row.
      // A concurrent tick that also selected it loses the CAS and skips.
      const won = await port.tryMarkNotificationSent(n.id, opts.now);
      if (won) sent += 1;
    } else {
      // EMAIL and any future channel: no transport wired yet → leave PENDING.
      deferred += 1;
    }
  }

  const assetsInScope = await port.countActiveAssets();

  return {
    ranAt: opts.now,
    notificationsSent: sent,
    notificationsDeferred: deferred,
    assetsInScope,
  };
}
