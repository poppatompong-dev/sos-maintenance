import type { EvaluatedResponse } from '../checklist';

/**
 * Fault derivation (doc 04/08): a failed checklist result must create a Fault and
 * a Corrective Work Order **idempotently** — reprocessing the same submission
 * must not create duplicates. Idempotency is achieved with deterministic keys,
 * so the persistence layer can upsert on them.
 */
export interface DerivedFault {
  /** Stable key: reprocessing the same failure yields the same key. */
  idempotencyKey: string;
  itemCode: string;
  severity: 'CRITICAL' | 'NON_CRITICAL';
  symptom: string;
  sourceRef: string;
}

/** Deterministic fault key for one failed item within a work order. */
export function faultKey(workOrderId: string, itemCode: string): string {
  return `fault:${workOrderId}:${itemCode}`;
}

/** Deterministic corrective work-order key for a fault (idempotent creation). */
export function correctiveWorkOrderKey(fault: { idempotencyKey: string }): string {
  return `cowo:${fault.idempotencyKey}`;
}

/**
 * Derive one fault per FAILED response. PASS/NA/UNKNOWN never produce faults
 * (UNKNOWN affects readiness, not fault creation). Deduplicated by item code.
 */
export function deriveFaults(
  workOrderId: string,
  responses: readonly EvaluatedResponse[],
): DerivedFault[] {
  const seen = new Set<string>();
  const faults: DerivedFault[] = [];
  for (const r of responses) {
    if (r.result !== 'FAIL') continue;
    if (seen.has(r.itemCode)) continue;
    seen.add(r.itemCode);
    faults.push({
      idempotencyKey: faultKey(workOrderId, r.itemCode),
      itemCode: r.itemCode,
      severity: r.criticality,
      symptom: `${r.label} ไม่ผ่าน`,
      sourceRef: r.criticalFunctionKey ?? r.itemCode,
    });
  }
  return faults;
}

/** True when at least one derived fault is critical (⇒ pole is DOWN, notify). */
export function hasCriticalFault(faults: readonly DerivedFault[]): boolean {
  return faults.some((f) => f.severity === 'CRITICAL');
}
