import { assertCan } from '@/domain/authz/policy';
import type { AppRole } from '@/domain/work/types';

/**
 * Application service: record a repair + its retest against an open fault
 * (doc 04/08). The retest outcome drives the fault's next state — a passing
 * retest RESOLVES it, a failing retest REOPENS it for another cycle. Pure aside
 * from the injected port; the corrective work-order lifecycle stays in the
 * work-order state machine.
 */
export type FaultRepairStatus = 'RESOLVED' | 'REOPENED';

export interface FaultForRepair {
  id: string;
  code: string;
  status: string;
  assetId: string;
}

export interface PersistRepairInput {
  faultId: string;
  workOrderId: string;
  cause: string;
  fixDescription: string;
  changedParts?: string;
  retestPassed: boolean;
  retestNote?: string;
  newFaultStatus: FaultRepairStatus;
  now: Date;
}

export interface RepairPort {
  loadFaultByCode(code: string): Promise<FaultForRepair | null>;
  workOrderExists(workOrderId: string): Promise<boolean>;
  persistRepair(input: PersistRepairInput): Promise<void>;
}

export class RepairError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'RepairError';
    this.code = code;
  }
}

export interface RecordRepairCommand {
  faultCode: string;
  workOrderId: string;
  cause: string;
  fixDescription: string;
  changedParts?: string;
  retestPassed: boolean;
  retestNote?: string;
  actor: { userId: string; roles: AppRole[] };
  now: Date;
}

export interface RecordRepairResult {
  faultCode: string;
  status: FaultRepairStatus;
}

export async function recordRepair(
  port: RepairPort,
  cmd: RecordRepairCommand,
): Promise<RecordRepairResult> {
  assertCan(cmd.actor.roles, 'repair:submit');

  const fault = await port.loadFaultByCode(cmd.faultCode);
  if (!fault) {
    throw new RepairError('FAULT_NOT_FOUND', `ไม่พบข้อขัดข้อง ${cmd.faultCode}`);
  }
  if (fault.status === 'RESOLVED') {
    throw new RepairError('FAULT_ALREADY_RESOLVED', 'ข้อขัดข้องนี้ปิดแล้ว');
  }
  if (!(await port.workOrderExists(cmd.workOrderId))) {
    throw new RepairError('WORKORDER_NOT_FOUND', 'ไม่พบใบงานซ่อมที่อ้างถึง');
  }

  // Rule (doc 04): retest PASS ⇒ resolve; retest FAIL ⇒ reopen for another cycle.
  const newFaultStatus: FaultRepairStatus = cmd.retestPassed
    ? 'RESOLVED'
    : 'REOPENED';

  await port.persistRepair({
    faultId: fault.id,
    workOrderId: cmd.workOrderId,
    cause: cmd.cause,
    fixDescription: cmd.fixDescription,
    changedParts: cmd.changedParts,
    retestPassed: cmd.retestPassed,
    retestNote: cmd.retestNote,
    newFaultStatus,
    now: cmd.now,
  });

  return { faultCode: fault.code, status: newFaultStatus };
}
