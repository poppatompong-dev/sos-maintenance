import type { CriticalCheckResult } from '../readiness';

export type ResponseResult = 'PASS' | 'FAIL' | 'NA' | 'UNKNOWN';

/** A single evaluated checklist response (the shape the domain reasons over). */
export interface EvaluatedResponse {
  itemCode: string;
  label: string;
  result: ResponseResult;
  criticality: 'CRITICAL' | 'NON_CRITICAL';
  /** Set when this item verifies a readiness-critical function. */
  criticalFunctionKey?: string;
  observedAt?: Date | null;
}

/** A required critical function (key + Thai label). */
export interface RequiredCriticalFunction {
  key: string;
  label: string;
}

/**
 * Collapse checklist responses into one result per required critical function,
 * ready to feed the readiness engine. Rule per function: any FAIL ⇒ FAIL; else at
 * least one PASS ⇒ PASS; otherwise UNKNOWN (no fresh result).
 */
export function toCriticalCheckResults(
  responses: readonly EvaluatedResponse[],
  requiredFunctions: readonly RequiredCriticalFunction[],
): CriticalCheckResult[] {
  return requiredFunctions.map((fn) => {
    const forFn = responses.filter((r) => r.criticalFunctionKey === fn.key);
    let result: CriticalCheckResult['result'] = 'UNKNOWN';
    let observedAt: Date | null = null;
    if (forFn.some((r) => r.result === 'FAIL')) {
      result = 'FAIL';
    } else if (forFn.some((r) => r.result === 'PASS')) {
      result = 'PASS';
    }
    for (const r of forFn) {
      if (r.observedAt && (!observedAt || r.observedAt > observedAt)) {
        observedAt = r.observedAt;
      }
    }
    return { key: fn.key, label: fn.label, result, observedAt };
  });
}

/** True when every critical response passed (used for PM self-close). */
export function allCriticalPassed(
  responses: readonly EvaluatedResponse[],
): boolean {
  const critical = responses.filter((r) => r.criticality === 'CRITICAL');
  return critical.length > 0 && critical.every((r) => r.result === 'PASS');
}
