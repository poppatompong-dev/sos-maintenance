import {
  evaluateReadiness,
  type AssetReadinessFacts,
  type ReadinessReason,
  type ReadinessStatus,
} from '@/domain/readiness';
import type { EmailTransport } from '@/server/email/transport';

/**
 * Job tick (doc 03, serverless variant). The background worker's periodic jobs,
 * runnable as a single on-demand pass so a cron trigger (Vercel Cron / GitHub
 * Actions) can drive them without an always-on process. Idempotent and bounded:
 * each tick claims a limited batch, so repeated ticks converge without piling up.
 *
 * V1 jobs:
 *  - notification dispatch: PENDING in-app notifications are delivered (marked
 *    SENT). EMAIL notifications are dispatched via EmailTransport (Nodemailer, OPS-05)
 *    when SMTP is configured and recipient email exists; otherwise left PENDING.
 *  - readiness reconciliation (RDY-06): periodic recompute of all active assets
 *    against current time (e.g. flipping WATCH→UNKNOWN when grace period expires).
 *    Writes a ReadinessSnapshot with trigger RECONCILIATION whenever status or reasons flip.
 */
export interface PendingNotification {
  id: string;
  channel: string;
  subject?: string;
  body?: string;
  recipientEmail?: string | null;
}

export interface AssetRecomputeCandidate {
  id: string;
  code: string;
  baselineApproved: boolean;
  retired: boolean;
  currentReadinessStatus: ReadinessStatus | null;
  currentReadinessReasons: ReadinessReason[] | null;
  readinessFacts: AssetReadinessFacts;
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
  /** Mark notification delivery failed with error details. */
  tryMarkNotificationFailed?(id: string, error: string): Promise<boolean>;
  countActiveAssets(): Promise<number>;
  /** Fetch active non-retired assets with readiness facts for periodic recompute. */
  loadActiveAssetsForRecompute?(): Promise<AssetRecomputeCandidate[]>;
  /** Persist a new ReadinessSnapshot and update asset currentReadiness on status/reason change. */
  persistReadinessRecompute?(
    assetId: string,
    status: ReadinessStatus,
    reasons: ReadinessReason[],
    now: Date,
  ): Promise<void>;
}

export interface JobTickResult {
  ranAt: Date;
  notificationsSent: number;
  notificationsFailed: number;
  notificationsDeferred: number;
  assetsInScope: number;
  assetsRecomputed: number;
  readinessFlips: number;
}

export interface JobTickOptions {
  now: Date;
  /** Max notifications to process this tick (keeps each run bounded). */
  limit?: number;
  /** Optional EmailTransport for dispatching EMAIL channel notifications (OPS-05). */
  emailTransport?: EmailTransport | null;
}

function hasReadinessChanged(
  currentStatus: ReadinessStatus | null,
  currentReasons: ReadinessReason[] | null,
  newStatus: ReadinessStatus,
  newReasons: ReadinessReason[],
): boolean {
  if (currentStatus === null || currentStatus !== newStatus) return true;
  if (currentReasons === null) return true;
  if (currentReasons.length !== newReasons.length) return true;
  for (let i = 0; i < currentReasons.length; i++) {
    if (
      currentReasons[i].code !== newReasons[i].code ||
      currentReasons[i].message !== newReasons[i].message ||
      currentReasons[i].sourceRef !== newReasons[i].sourceRef
    ) {
      return true;
    }
  }
  return false;
}

export async function runJobTick(
  port: JobTickPort,
  opts: JobTickOptions,
): Promise<JobTickResult> {
  const limit = opts.limit ?? 50;
  const pending = await port.claimPendingNotifications(limit);

  let sent = 0;
  let failed = 0;
  let deferred = 0;

  for (const n of pending) {
    if (n.channel === 'IN_APP') {
      // Conditional claim: only count as sent if THIS tick flipped the row.
      // A concurrent tick that also selected it loses the CAS and skips.
      const won = await port.tryMarkNotificationSent(n.id, opts.now);
      if (won) sent += 1;
    } else if (n.channel === 'EMAIL') {
      if (opts.emailTransport && n.recipientEmail) {
        const sendResult = await opts.emailTransport.sendEmail({
          to: n.recipientEmail,
          subject: n.subject ?? 'แจ้งเตือนระบบซ่อมบำรุง SOS',
          text: n.body ?? '',
        });

        if (sendResult.success) {
          const won = await port.tryMarkNotificationSent(n.id, opts.now);
          if (won) sent += 1;
        } else {
          if (port.tryMarkNotificationFailed) {
            await port.tryMarkNotificationFailed(
              n.id,
              sendResult.error ?? 'Email delivery failed',
            );
          }
          failed += 1;
        }
      } else {
        // EMAIL channel with no transport or no recipient email -> leave PENDING.
        deferred += 1;
      }
    } else {
      deferred += 1;
    }
  }

  const assetsInScope = await port.countActiveAssets();

  let assetsRecomputed = 0;
  let readinessFlips = 0;

  if (port.loadActiveAssetsForRecompute && port.persistReadinessRecompute) {
    const candidates = await port.loadActiveAssetsForRecompute();
    for (const asset of candidates) {
      assetsRecomputed += 1;
      const evaluation = evaluateReadiness({
        now: opts.now,
        baselineApproved: asset.baselineApproved,
        criticalChecks: asset.readinessFacts.criticalChecks,
        openCriticalFault: asset.readinessFacts.openCriticalFault,
        openNonCriticalIssue: asset.readinessFacts.openNonCriticalIssue,
        nextDueAt: asset.readinessFacts.nextDueAt,
      });

      if (
        hasReadinessChanged(
          asset.currentReadinessStatus,
          asset.currentReadinessReasons,
          evaluation.status,
          evaluation.reasons,
        )
      ) {
        readinessFlips += 1;
        await port.persistReadinessRecompute(
          asset.id,
          evaluation.status,
          evaluation.reasons,
          opts.now,
        );
      }
    }
  }

  return {
    ranAt: opts.now,
    notificationsSent: sent,
    notificationsFailed: failed,
    notificationsDeferred: deferred,
    assetsInScope,
    assetsRecomputed,
    readinessFlips,
  };
}
