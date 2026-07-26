import type { AppRole, MaintenanceKind, WorkOrderStatus } from '../work/types';

/**
 * Baseline approval (spec 08 §"Admin/Planner ตรวจทะเบียน 27 จุด สร้าง Initial
 * Survey และอนุมัติ baseline"; UAT cases 1 and 11).
 *
 * A pole's readiness can never be asserted until a human has approved its
 * baseline — until then the readiness engine reports UNKNOWN with reason
 * `NO_APPROVED_BASELINE`. Approval is therefore the one deliberately *chosen*
 * fact in an otherwise computed pipeline, which is exactly why it needs
 * evidence and separation of duties rather than a bare toggle.
 *
 * The rule: a Planner/Admin may approve only when the asset has an
 * INITIAL_SURVEY work order that has been **accepted** (CLOSED), and the
 * approver is not the person who submitted that survey.
 *
 * Pure — the caller supplies the facts; this module never touches a DB.
 */

export const BASELINE_DENIAL = {
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  ASSET_RETIRED: 'ASSET_RETIRED',
  ALREADY_APPROVED: 'ALREADY_APPROVED',
  SURVEY_MISSING: 'SURVEY_MISSING',
  SURVEY_WRONG_KIND: 'SURVEY_WRONG_KIND',
  SURVEY_NOT_ACCEPTED: 'SURVEY_NOT_ACCEPTED',
  SUBMITTER_UNKNOWN: 'SUBMITTER_UNKNOWN',
  SELF_APPROVAL: 'SELF_APPROVAL',
} as const;

export type BaselineDenialCode =
  (typeof BASELINE_DENIAL)[keyof typeof BASELINE_DENIAL];

/** Thai operator-facing message per denial. Never show the bare code. */
export const BASELINE_DENIAL_TEXT: Record<BaselineDenialCode, string> = {
  NOT_AUTHORIZED: 'เฉพาะผู้วางแผน/ผู้ควบคุมงานเท่านั้นที่อนุมัติผลสำรวจตั้งต้นได้',
  ASSET_RETIRED: 'จุดติดตั้งนี้ถูกปลดระวางแล้ว อนุมัติผลสำรวจตั้งต้นไม่ได้',
  ALREADY_APPROVED: 'จุดติดตั้งนี้มีผลสำรวจตั้งต้นที่อนุมัติแล้ว',
  SURVEY_MISSING: 'ยังไม่มีใบงานสำรวจตั้งต้นของจุดติดตั้งนี้',
  SURVEY_WRONG_KIND: 'ใบงานที่อ้างอิงไม่ใช่ใบงานสำรวจตั้งต้น',
  SURVEY_NOT_ACCEPTED: 'ใบงานสำรวจตั้งต้นยังไม่ผ่านการตรวจรับ',
  SUBMITTER_UNKNOWN: 'ไม่ทราบผู้ส่งใบงานสำรวจตั้งต้น จึงยืนยันการแยกหน้าที่ไม่ได้',
  SELF_APPROVAL: 'ผู้อนุมัติต้องไม่ใช่ผู้ส่งผลสำรวจ (แยกหน้าที่อนุมัติ)',
};

/** The survey work order cited as evidence for the approval. */
export interface BaselineSurveyEvidence {
  kind: MaintenanceKind;
  status: WorkOrderStatus;
  /** Who submitted the survey — required, for separation of duties. */
  submittedByUserId?: string;
}

export interface BaselineApprovalContext {
  actorRole: AppRole;
  actorUserId: string;
  /** Current approval state of the asset (approval is once-only). */
  alreadyApproved: boolean;
  /** A retired asset never gets a baseline. */
  assetRetired: boolean;
  /** Absent when the asset has no initial survey at all. */
  survey?: BaselineSurveyEvidence;
}

export interface BaselineApprovalDecision {
  allowed: boolean;
  code?: BaselineDenialCode;
  reason?: string;
}

const ALLOWED: BaselineApprovalDecision = { allowed: true };

const deny = (code: BaselineDenialCode): BaselineApprovalDecision => ({
  allowed: false,
  code,
  reason: BASELINE_DENIAL_TEXT[code],
});

const isPlanner = (role: AppRole): boolean =>
  role === 'PLANNER' || role === 'SYSTEM_ADMIN';

export function canApproveBaseline(
  ctx: BaselineApprovalContext,
): BaselineApprovalDecision {
  if (!isPlanner(ctx.actorRole)) return deny(BASELINE_DENIAL.NOT_AUTHORIZED);
  if (ctx.assetRetired) return deny(BASELINE_DENIAL.ASSET_RETIRED);
  if (ctx.alreadyApproved) return deny(BASELINE_DENIAL.ALREADY_APPROVED);

  const survey = ctx.survey;
  if (!survey) return deny(BASELINE_DENIAL.SURVEY_MISSING);
  if (survey.kind !== 'INITIAL_SURVEY') {
    return deny(BASELINE_DENIAL.SURVEY_WRONG_KIND);
  }
  // Only an *accepted* survey counts. A SUBMITTED survey has not been reviewed
  // yet; REJECTED/REOPENED/CANCELLED are not evidence of anything.
  if (survey.status !== 'CLOSED') {
    return deny(BASELINE_DENIAL.SURVEY_NOT_ACCEPTED);
  }
  // Separation of duties: we must be able to prove the approver is not the
  // submitter. An unknown submitter fails closed rather than silently passing.
  if (!survey.submittedByUserId) {
    return deny(BASELINE_DENIAL.SUBMITTER_UNKNOWN);
  }
  if (survey.submittedByUserId === ctx.actorUserId) {
    return deny(BASELINE_DENIAL.SELF_APPROVAL);
  }

  return ALLOWED;
}
