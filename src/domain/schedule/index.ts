/**
 * Schedule-batch planning rules (doc 04/08), pure. A ScheduleBatch turns a
 * recurring MaintenancePlan into a concrete round of work orders:
 *   DRAFT → APPROVED → PUBLISHED   (forward-only; PUBLISHED is terminal)
 * Role permissions (schedule:create/approve/publish) are enforced server-side by
 * the RBAC guard; this module owns only the valid-edge graph + code formatting so
 * it stays framework/DB free and unit-testable.
 */
export type ScheduleBatchStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED';

const BATCH_TRANSITIONS: Record<ScheduleBatchStatus, readonly ScheduleBatchStatus[]> = {
  DRAFT: ['APPROVED'],
  APPROVED: ['PUBLISHED'],
  PUBLISHED: [],
};

export function allowedBatchNext(
  from: ScheduleBatchStatus,
): readonly ScheduleBatchStatus[] {
  return BATCH_TRANSITIONS[from];
}

export interface BatchTransitionDecision {
  allowed: boolean;
  reason?: string;
}

export function canBatchTransition(
  from: ScheduleBatchStatus,
  to: ScheduleBatchStatus,
): BatchTransitionDecision {
  return BATCH_TRANSITIONS[from].includes(to)
    ? { allowed: true }
    : { allowed: false, reason: `เปลี่ยนสถานะชุดงานจาก ${from} ไป ${to} ไม่ได้` };
}

/** Canonical work-order code: WO-YYYY-NNNN (seq zero-padded to 4). */
export function formatWorkOrderCode(year: number, seq: number): string {
  return `WO-${year}-${String(seq).padStart(4, '0')}`;
}
