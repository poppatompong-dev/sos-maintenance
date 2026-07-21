import { addDays, isAfter, isAfterOrEqual } from '../shared/date';
import {
  READINESS_REASON,
  READINESS_REASON_MESSAGE_TH,
  type ReadinessReasonCode,
} from './reason-codes';
import {
  DEFAULT_GRACE_DAYS,
  type ReadinessInput,
  type ReadinessReason,
  type ReadinessResult,
} from './types';

function message(code: ReadinessReasonCode, label?: string): string {
  const template = READINESS_REASON_MESSAGE_TH[code];
  return label ? template.replace('{label}', label) : template;
}

function reason(
  code: ReadinessReasonCode,
  opts?: { label?: string; sourceRef?: string },
): ReadinessReason {
  return {
    code,
    message: message(code, opts?.label),
    ...(opts?.sourceRef ? { sourceRef: opts.sourceRef } : {}),
  };
}

/**
 * Pure readiness engine. Given an evidence snapshot, returns the computed status
 * with the reasons that produced it. No I/O, no ambient clock, no user-picked
 * colour — the status is *derived* (doc 01/08).
 *
 * Precedence is strict: DOWN > UNKNOWN > WATCH > READY. The most severe bucket
 * that has any triggering reason wins; if none trigger, the asset is READY.
 */
export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const graceDays = input.graceDays ?? DEFAULT_GRACE_DAYS;
  const evaluatedAt = input.now;

  const overdue =
    input.nextDueAt !== null && isAfter(input.now, input.nextDueAt);
  const overdueBeyondGrace =
    input.nextDueAt !== null &&
    isAfter(input.now, addDays(input.nextDueAt, graceDays));
  const overdueWithinGrace = overdue && !overdueBeyondGrace;

  // ── DOWN ────────────────────────────────────────────────────────────────
  const downReasons: ReadinessReason[] = [];
  for (const check of input.criticalChecks) {
    if (check.result === 'FAIL') {
      downReasons.push(
        reason(READINESS_REASON.CRITICAL_FUNCTION_FAILED, {
          label: check.label,
          sourceRef: check.key,
        }),
      );
    }
  }
  if (input.openCriticalFault) {
    downReasons.push(reason(READINESS_REASON.OPEN_CRITICAL_FAULT));
  }
  if (downReasons.length > 0) {
    return { status: 'DOWN', reasons: downReasons, evaluatedAt };
  }

  // ── UNKNOWN ─────────────────────────────────────────────────────────────
  const unknownReasons: ReadinessReason[] = [];
  if (!input.baselineApproved) {
    unknownReasons.push(reason(READINESS_REASON.NO_APPROVED_BASELINE));
  }
  // A required critical function with no fresh PASS/FAIL result means we cannot
  // assert readiness — treat as insufficient data.
  if (input.criticalChecks.length === 0) {
    unknownReasons.push(reason(READINESS_REASON.CRITICAL_RESULT_MISSING));
  }
  for (const check of input.criticalChecks) {
    if (check.result === 'UNKNOWN') {
      unknownReasons.push(
        reason(READINESS_REASON.CRITICAL_RESULT_MISSING, {
          label: check.label,
          sourceRef: check.key,
        }),
      );
    }
  }
  if (overdueBeyondGrace) {
    unknownReasons.push(reason(READINESS_REASON.OVERDUE_BEYOND_GRACE));
  }
  if (unknownReasons.length > 0) {
    return { status: 'UNKNOWN', reasons: unknownReasons, evaluatedAt };
  }

  // ── WATCH ───────────────────────────────────────────────────────────────
  const watchReasons: ReadinessReason[] = [];
  if (input.openNonCriticalIssue) {
    watchReasons.push(reason(READINESS_REASON.NON_CRITICAL_ISSUE));
  }
  if (overdueWithinGrace) {
    watchReasons.push(reason(READINESS_REASON.OVERDUE_WITHIN_GRACE));
  }
  if (watchReasons.length > 0) {
    return { status: 'WATCH', reasons: watchReasons, evaluatedAt };
  }

  // ── READY ───────────────────────────────────────────────────────────────
  return {
    status: 'READY',
    reasons: [reason(READINESS_REASON.ALL_CRITICAL_PASS)],
    evaluatedAt,
  };
}

// Re-exported for callers that only need the guard without the full engine.
export { isAfter, isAfterOrEqual, addDays };
