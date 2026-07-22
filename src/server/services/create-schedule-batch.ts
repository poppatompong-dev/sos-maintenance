import { assertCan } from '@/domain/authz/policy';
import type { AppRole, MaintenanceKind } from '@/domain/work/types';

/**
 * Application service: create a schedule batch from a recurring maintenance plan
 * (doc 04/08). Creating a batch materialises one DRAFT work order per active
 * asset of the plan's asset type — the concrete round a Planner will approve then
 * publish. Pure aside from the injected port; the batch state machine lives in
 * `domain/schedule`.
 */
export interface PlanForSchedule {
  id: string;
  kind: MaintenanceKind;
  assetTypeKey: string;
  checklistVersionId: string | null;
  active: boolean;
}

export interface CreateBatchPersistInput {
  planId: string;
  kind: MaintenanceKind;
  assetTypeKey: string;
  checklistVersionId: string;
  name: string;
  /** Who created the batch — persisted for separation-of-duties on approval. */
  createdById: string;
  scheduledFor: Date | null;
  dueAt: Date | null;
  now: Date;
}

export interface ScheduleCreatePort {
  loadPlan(planId: string): Promise<PlanForSchedule | null>;
  createBatchWithWorkOrders(
    input: CreateBatchPersistInput,
  ): Promise<{ batchId: string; workOrdersCreated: number }>;
}

export class ScheduleError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ScheduleError';
    this.code = code;
  }
}

export interface CreateScheduleBatchCommand {
  planId: string;
  name: string;
  scheduledFor?: Date | null;
  dueAt?: Date | null;
  actor: { userId: string; roles: AppRole[] };
  now: Date;
}

export interface CreateScheduleBatchResult {
  batchId: string;
  status: 'DRAFT';
  workOrdersCreated: number;
}

export async function createScheduleBatch(
  port: ScheduleCreatePort,
  cmd: CreateScheduleBatchCommand,
): Promise<CreateScheduleBatchResult> {
  assertCan(cmd.actor.roles, 'schedule:create');

  const plan = await port.loadPlan(cmd.planId);
  if (!plan) {
    throw new ScheduleError('PLAN_NOT_FOUND', `ไม่พบแผนบำรุงรักษา ${cmd.planId}`);
  }
  if (!plan.active) {
    throw new ScheduleError('PLAN_INACTIVE', 'แผนนี้ถูกปิดใช้งานแล้ว');
  }
  if (!plan.checklistVersionId) {
    throw new ScheduleError('PLAN_NO_CHECKLIST', 'แผนยังไม่ผูกเวอร์ชันเช็คลิสต์');
  }

  const { batchId, workOrdersCreated } = await port.createBatchWithWorkOrders({
    planId: plan.id,
    kind: plan.kind,
    assetTypeKey: plan.assetTypeKey,
    checklistVersionId: plan.checklistVersionId,
    name: cmd.name,
    createdById: cmd.actor.userId,
    scheduledFor: cmd.scheduledFor ?? null,
    dueAt: cmd.dueAt ?? null,
    now: cmd.now,
  });

  return { batchId, status: 'DRAFT', workOrdersCreated };
}
