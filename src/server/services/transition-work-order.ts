import { canTransition, type TransitionDecision } from '@/domain/work/state-machine';
import type { AppRole, MaintenanceKind, WorkOrderStatus } from '@/domain/work/types';

/**
 * Application service: move a work order to a new status (doc 04/08). All the
 * transition rules — valid graph edges, role permissions, separation of duties,
 * technician self-close of a passing PM — live in the pure `canTransition` state
 * machine. This service loads the facts, evaluates the decision across the
 * actor's roles (any role that permits wins), and persists atomically through an
 * injected port (Prisma in prod, in-memory in tests).
 */
export interface WorkOrderState {
  id: string;
  code: string;
  status: WorkOrderStatus;
  kind: MaintenanceKind;
  version: number;
  /** Actor who performed the SUBMITTED transition (separation-of-duties input). */
  submittedByUserId?: string;
  /** Whether every critical checklist item passed (enables PM self-close). */
  allChecklistPassed?: boolean;
}

export interface ApplyTransitionInput {
  workOrderId: string;
  from: WorkOrderStatus;
  to: WorkOrderStatus;
  actorUserId: string;
  note?: string;
  now: Date;
  /** Optimistic-concurrency guard — persist only if the row still has this. */
  expectedVersion: number;
  /** Required when `to === 'ASSIGNED'` — who the work order is actually handed to. */
  assigneeUserId?: string;
}

export interface WorkOrderTransitionPort {
  loadByCode(code: string): Promise<WorkOrderState | null>;
  /** True when `userId` is a real, active technician — never trust a client-supplied id blindly. */
  assigneeIsActiveTechnician(userId: string): Promise<boolean>;
  applyTransition(
    input: ApplyTransitionInput,
  ): Promise<{ status: WorkOrderStatus; version: number }>;
}

export class WorkOrderTransitionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'WorkOrderTransitionError';
    this.code = code;
  }
}

export interface TransitionCommand {
  code: string;
  to: WorkOrderStatus;
  actor: { userId: string; roles: AppRole[] };
  note?: string;
  now: Date;
  assigneeUserId?: string;
}

export interface TransitionResult {
  code: string;
  from: WorkOrderStatus;
  status: WorkOrderStatus;
  version: number;
}

export async function transitionWorkOrder(
  port: WorkOrderTransitionPort,
  cmd: TransitionCommand,
): Promise<TransitionResult> {
  const wo = await port.loadByCode(cmd.code);
  if (!wo) {
    throw new WorkOrderTransitionError('WORKORDER_NOT_FOUND', `ไม่พบใบงาน ${cmd.code}`);
  }

  // Any role that permits the transition wins; otherwise keep the last reason.
  let decision: TransitionDecision = {
    allowed: false,
    reason: 'ไม่มีสิทธิ์ดำเนินการ',
  };
  for (const role of cmd.actor.roles) {
    decision = canTransition({
      from: wo.status,
      to: cmd.to,
      kind: wo.kind,
      actorRole: role,
      actorUserId: cmd.actor.userId,
      submittedByUserId: wo.submittedByUserId,
      allChecklistPassed: wo.allChecklistPassed,
    });
    if (decision.allowed) break;
  }
  if (!decision.allowed) {
    throw new WorkOrderTransitionError(
      'TRANSITION_NOT_ALLOWED',
      decision.reason ?? 'เปลี่ยนสถานะไม่ได้',
    );
  }

  if (cmd.to === 'ASSIGNED') {
    if (!cmd.assigneeUserId) {
      throw new WorkOrderTransitionError('ASSIGNEE_REQUIRED', 'ต้องเลือกช่างที่จะมอบหมายงาน');
    }
    if (!(await port.assigneeIsActiveTechnician(cmd.assigneeUserId))) {
      throw new WorkOrderTransitionError('ASSIGNEE_INVALID', 'ไม่พบช่างที่เลือก หรือช่างไม่ได้ใช้งานอยู่');
    }
  }

  const applied = await port.applyTransition({
    workOrderId: wo.id,
    from: wo.status,
    to: cmd.to,
    actorUserId: cmd.actor.userId,
    note: cmd.note,
    now: cmd.now,
    expectedVersion: wo.version,
    assigneeUserId: cmd.to === 'ASSIGNED' ? cmd.assigneeUserId : undefined,
  });

  return { code: wo.code, from: wo.status, status: applied.status, version: applied.version };
}
