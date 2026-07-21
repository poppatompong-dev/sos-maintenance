import {
  RECURRING_PM_KINDS,
  type AppRole,
  type MaintenanceKind,
  type WorkOrderStatus,
} from './types';

/**
 * Work-order state machine (doc 04/08). Enforces valid transitions, role
 * permissions, and separation of duties. Pure — the caller supplies the current
 * facts; this function never touches a DB.
 *
 * Graph:
 *   DRAFT      → PUBLISHED | ASSIGNED | CANCELLED
 *   PUBLISHED  → ASSIGNED | CANCELLED
 *   ASSIGNED   → IN_PROGRESS | CANCELLED
 *   IN_PROGRESS→ SUBMITTED | CANCELLED
 *   SUBMITTED  → CLOSED | REJECTED
 *   REJECTED   → IN_PROGRESS | CANCELLED     (rework)
 *   CLOSED     → REOPENED                     (correction)
 *   REOPENED   → IN_PROGRESS | CANCELLED
 *   CANCELLED  → (terminal)
 */
const TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  DRAFT: ['PUBLISHED', 'ASSIGNED', 'CANCELLED'],
  PUBLISHED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['CLOSED', 'REJECTED'],
  REJECTED: ['IN_PROGRESS', 'CANCELLED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'CANCELLED'],
  CANCELLED: [],
};

export function allowedNextStatuses(
  from: WorkOrderStatus,
): readonly WorkOrderStatus[] {
  return TRANSITIONS[from];
}

export interface TransitionContext {
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  kind: MaintenanceKind;
  actorRole: AppRole;
  actorUserId: string;
  /** Who submitted the work (for separation-of-duties on acceptance). */
  submittedByUserId?: string;
  /** Whether every critical checklist item passed (enables PM self-close). */
  allChecklistPassed?: boolean;
}

export interface TransitionDecision {
  allowed: boolean;
  reason?: string;
}

const isPlanner = (role: AppRole): boolean =>
  role === 'PLANNER' || role === 'SYSTEM_ADMIN';

const deny = (reason: string): TransitionDecision => ({ allowed: false, reason });
const allow: TransitionDecision = { allowed: true };

export function canTransition(ctx: TransitionContext): TransitionDecision {
  if (!TRANSITIONS[ctx.from].includes(ctx.to)) {
    return deny(`เปลี่ยนสถานะจาก ${ctx.from} ไป ${ctx.to} ไม่ได้`);
  }

  // Acceptance (SUBMITTED → CLOSED) carries the richest rules.
  if (ctx.to === 'CLOSED') {
    const recurringPM = RECURRING_PM_KINDS.includes(ctx.kind);
    if (isPlanner(ctx.actorRole)) {
      // Separation of duties: the accepter must not be the submitter.
      if (
        ctx.submittedByUserId &&
        ctx.actorUserId === ctx.submittedByUserId
      ) {
        return deny('ผู้ตรวจรับต้องไม่ใช่ผู้ส่งงาน (แยกหน้าที่ตรวจรับ)');
      }
      return allow;
    }
    if (ctx.actorRole === 'TECHNICIAN') {
      // A passing recurring PM may be closed immediately by the technician;
      // corrective work, initial survey, or any failure needs Planner accept.
      if (recurringPM && ctx.allChecklistPassed === true) return allow;
      return deny('งานนี้ต้องให้ผู้วางแผนตรวจรับก่อนปิด');
    }
    return deny('ไม่มีสิทธิ์ปิดงาน');
  }

  // Planner/Admin-only transitions.
  if (['PUBLISHED', 'ASSIGNED', 'REJECTED', 'REOPENED'].includes(ctx.to)) {
    return isPlanner(ctx.actorRole)
      ? allow
      : deny('เฉพาะผู้วางแผน/ผู้ควบคุมงานเท่านั้น');
  }

  // Cancellation is a Planner/Admin action.
  if (ctx.to === 'CANCELLED') {
    return isPlanner(ctx.actorRole)
      ? allow
      : deny('เฉพาะผู้วางแผน/ผู้ควบคุมงานเท่านั้นที่ยกเลิกงานได้');
  }

  // Technician field actions.
  if (ctx.to === 'IN_PROGRESS' || ctx.to === 'SUBMITTED') {
    return ctx.actorRole === 'TECHNICIAN'
      ? allow
      : deny('เฉพาะเจ้าหน้าที่ภาคสนามเท่านั้น');
  }

  return deny('ไม่อนุญาต');
}
