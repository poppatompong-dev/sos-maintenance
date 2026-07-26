import { assertCan } from '../../domain/authz/policy';
import {
  canApproveBaseline,
  type BaselineApprovalDecision,
  type BaselineSurveyEvidence,
} from '../../domain/asset';
import { evaluateReadiness, type ReadinessResult } from '../../domain/readiness';
import type { CriticalCheckResult } from '../../domain/readiness';
import type { AppRole } from '../../domain/work/types';

/**
 * Application service: approve a pole's baseline (spec 08; UAT cases 1 and 11).
 *
 * Approval is the human act that unblocks readiness — until it happens the
 * engine reports UNKNOWN/`NO_APPROVED_BASELINE` no matter how much field
 * evidence exists. So this service does two things that must not come apart:
 * it records *who* approved and *when* against the accepted initial survey,
 * and it immediately recomputes readiness and writes a fresh immutable
 * ReadinessSnapshot — the status is still computed, never chosen.
 */

/** Facts the readiness engine needs, other than the baseline flag itself. */
export interface BaselineReadinessFacts {
  criticalChecks: CriticalCheckResult[];
  openCriticalFault: boolean;
  openNonCriticalIssue: boolean;
  nextDueAt: Date | null;
}

export interface BaselineAssetState {
  assetId: string;
  code: string;
  baselineApproved: boolean;
  retired: boolean;
  version: number;
  /** Most recent INITIAL_SURVEY work order for this asset, if any. */
  survey?: BaselineSurveyEvidence & { workOrderId: string };
  readinessFacts: BaselineReadinessFacts;
}

export interface PersistBaselineApprovalInput {
  assetId: string;
  approverUserId: string;
  approvedAt: Date;
  /** The accepted survey this approval rests on — recorded as the evidence. */
  surveyWorkOrderId: string;
  readiness: ReadinessResult;
  /** Optimistic-concurrency guard — persist only if the row still has this. */
  expectedVersion: number;
}

export interface ApproveBaselinePort {
  loadByCode(code: string): Promise<BaselineAssetState | null>;
  persist(input: PersistBaselineApprovalInput): Promise<void>;
}

export class BaselineApprovalError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BaselineApprovalError';
    this.code = code;
  }
}

export interface ApproveBaselineCommand {
  code: string;
  actor: { userId: string; roles: AppRole[] };
  now: Date;
}

export interface ApproveBaselineResult {
  code: string;
  approvedAt: Date;
  approverUserId: string;
  surveyWorkOrderId: string;
  readiness: ReadinessResult;
}

export async function approveBaseline(
  port: ApproveBaselinePort,
  cmd: ApproveBaselineCommand,
): Promise<ApproveBaselineResult> {
  // 1. Authorization (server-side, before anything else is loaded).
  assertCan(cmd.actor.roles, 'survey:approve');

  // 2. Load the asset and its evidence.
  const asset = await port.loadByCode(cmd.code);
  if (!asset) {
    throw new BaselineApprovalError(
      'ASSET_NOT_FOUND',
      `ไม่พบจุดติดตั้ง ${cmd.code}`,
    );
  }

  // 3. Object-level rule. Any role that permits wins; keep the last denial.
  let decision: BaselineApprovalDecision = {
    allowed: false,
    reason: 'ไม่มีสิทธิ์ดำเนินการ',
  };
  for (const role of cmd.actor.roles) {
    decision = canApproveBaseline({
      actorRole: role,
      actorUserId: cmd.actor.userId,
      alreadyApproved: asset.baselineApproved,
      assetRetired: asset.retired,
      survey: asset.survey,
    });
    if (decision.allowed) break;
  }
  if (!decision.allowed) {
    throw new BaselineApprovalError(
      decision.code ?? 'BASELINE_APPROVAL_NOT_ALLOWED',
      decision.reason ?? 'อนุมัติผลสำรวจตั้งต้นไม่ได้',
    );
  }
  // `canApproveBaseline` only returns allowed with a survey present; this keeps
  // the narrowing explicit rather than asserting non-null.
  const survey = asset.survey;
  if (!survey) {
    throw new BaselineApprovalError(
      'SURVEY_MISSING',
      'ยังไม่มีใบงานสำรวจตั้งต้นของจุดติดตั้งนี้',
    );
  }

  // 4. Readiness is recomputed with the baseline now approved — never chosen.
  const readiness = evaluateReadiness({
    now: cmd.now,
    baselineApproved: true,
    criticalChecks: asset.readinessFacts.criticalChecks,
    openCriticalFault: asset.readinessFacts.openCriticalFault,
    openNonCriticalIssue: asset.readinessFacts.openNonCriticalIssue,
    nextDueAt: asset.readinessFacts.nextDueAt,
  });

  // 5. Persist the approval + snapshot atomically (adapter's responsibility).
  await port.persist({
    assetId: asset.assetId,
    approverUserId: cmd.actor.userId,
    approvedAt: cmd.now,
    surveyWorkOrderId: survey.workOrderId,
    readiness,
    expectedVersion: asset.version,
  });

  return {
    code: asset.code,
    approvedAt: cmd.now,
    approverUserId: cmd.actor.userId,
    surveyWorkOrderId: survey.workOrderId,
    readiness,
  };
}
