import type { ReadinessReasonCode } from './reason-codes';

/** The four computed readiness states. Precedence: DOWN > UNKNOWN > WATCH > READY. */
export type ReadinessStatus = 'READY' | 'WATCH' | 'DOWN' | 'UNKNOWN';

/** Result of the latest evaluation of one required critical function. */
export interface CriticalCheckResult {
  /** Stable key, e.g. 'sos_button', 'two_way_audio'. */
  key: string;
  /** Thai label for humans, e.g. 'ปุ่ม SOS'. */
  label: string;
  /**
   * PASS / FAIL from the latest checklist response, or UNKNOWN when there is no
   * fresh result for this required critical function.
   */
  result: 'PASS' | 'FAIL' | 'UNKNOWN';
  /** When this result was observed (for traceability); null when unknown. */
  observedAt?: Date | null;
}

/**
 * Full evidence snapshot fed to the pure readiness engine. The caller (an
 * application service) is responsible for assembling this from the latest
 * approved baseline, checklist responses, faults and schedule — the engine
 * performs NO I/O and reads no clock of its own (`now` is injected).
 */
export interface ReadinessInput {
  /** Evaluation instant (UTC). Injected so the engine stays pure & testable. */
  now: Date;
  /** True once an Initial Survey has been approved by a Planner/Supervisor. */
  baselineApproved: boolean;
  /** Latest result for every *required* critical function of this asset. */
  criticalChecks: CriticalCheckResult[];
  /** Any open (unresolved) critical fault. */
  openCriticalFault: boolean;
  /** Any open non-critical defect/fault. */
  openNonCriticalIssue: boolean;
  /** When the next required inspection is due, or null if none scheduled. */
  nextDueAt: Date | null;
  /** Grace period in days before an overdue asset becomes UNKNOWN. Default 7. */
  graceDays?: number;
}

/** One reason contributing to a readiness decision. */
export interface ReadinessReason {
  code: ReadinessReasonCode;
  /** Human-facing Thai message with `{label}` already substituted. */
  message: string;
  /** Optional pointer to the source evidence (critical check key, etc.). */
  sourceRef?: string;
}

/** Output of the engine — status + the reasons that produced it. */
export interface ReadinessResult {
  status: ReadinessStatus;
  reasons: ReadinessReason[];
  evaluatedAt: Date;
}

/** Default grace period (doc 01/07: 7 days). */
export const DEFAULT_GRACE_DAYS = 7;
