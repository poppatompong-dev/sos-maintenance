import { canBatchTransition, type ScheduleBatchStatus } from '@/domain/schedule';
import type { AppRole } from '@/domain/work/types';

/**
 * Application service: advance a schedule batch DRAFT→APPROVED→PUBLISHED
 * (doc 04/08). Valid edges come from the pure `domain/schedule` state machine;
 * role permissions (schedule:approve / schedule:publish) are enforced by the
 * route's RBAC guard. Publishing releases the batch's DRAFT work orders.
 */
export interface ScheduleBatchState {
  id: string;
  status: ScheduleBatchStatus;
  version: number;
  /** Who created the batch (separation-of-duties: approver must differ). */
  createdById: string | null;
}

export interface ApplyBatchTransitionInput {
  id: string;
  from: ScheduleBatchStatus;
  to: ScheduleBatchStatus;
  /** Set on APPROVED — who approved (separation-of-duties evidence). */
  approverId?: string;
  now: Date;
  expectedVersion: number;
}

export interface BatchTransitionPort {
  loadBatchById(id: string): Promise<ScheduleBatchState | null>;
  applyBatchTransition(
    input: ApplyBatchTransitionInput,
  ): Promise<{ status: ScheduleBatchStatus; version: number }>;
}

export class BatchTransitionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'BatchTransitionError';
    this.code = code;
  }
}

export interface TransitionBatchCommand {
  id: string;
  to: ScheduleBatchStatus;
  actor: { userId: string; roles: AppRole[] };
  now: Date;
}

export interface TransitionBatchResult {
  id: string;
  from: ScheduleBatchStatus;
  status: ScheduleBatchStatus;
  version: number;
}

export async function transitionScheduleBatch(
  port: BatchTransitionPort,
  cmd: TransitionBatchCommand,
): Promise<TransitionBatchResult> {
  const batch = await port.loadBatchById(cmd.id);
  if (!batch) {
    throw new BatchTransitionError('BATCH_NOT_FOUND', `ไม่พบชุดงาน ${cmd.id}`);
  }

  const decision = canBatchTransition(batch.status, cmd.to);
  if (!decision.allowed) {
    throw new BatchTransitionError(
      'BATCH_TRANSITION_NOT_ALLOWED',
      decision.reason ?? 'เปลี่ยนสถานะชุดงานไม่ได้',
    );
  }

  // Separation of duties on approval. A batch with no known creator (legacy
  // null) is NOT approvable — otherwise SoD could be bypassed; and the approver
  // must not be the creator. Either way the batch stays DRAFT.
  if (cmd.to === 'APPROVED') {
    if (batch.createdById === null) {
      throw new BatchTransitionError(
        'CREATOR_UNKNOWN',
        'ไม่ทราบผู้สร้างชุดงาน จึงอนุมัติไม่ได้ (แยกหน้าที่)',
      );
    }
    if (cmd.actor.userId === batch.createdById) {
      throw new BatchTransitionError(
        'SELF_APPROVAL_FORBIDDEN',
        'ผู้อนุมัติต้องไม่ใช่ผู้สร้างชุดงาน (แยกหน้าที่)',
      );
    }
  }

  const applied = await port.applyBatchTransition({
    id: batch.id,
    from: batch.status,
    to: cmd.to,
    approverId: cmd.to === 'APPROVED' ? cmd.actor.userId : undefined,
    now: cmd.now,
    expectedVersion: batch.version,
  });

  return { id: batch.id, from: batch.status, status: applied.status, version: applied.version };
}
