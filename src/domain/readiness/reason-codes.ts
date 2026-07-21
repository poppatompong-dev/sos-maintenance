/**
 * Stable, machine-readable reason codes for every readiness decision. These are
 * persisted verbatim inside each immutable ReadinessSnapshot so a status can
 * always be traced back to *why* it was computed (doc 01/08 readiness rules).
 *
 * Codes are stable identifiers — never rename an existing code; add new ones.
 * Thai messages are for humans and may be revised.
 */
export const READINESS_REASON = {
  // READY
  ALL_CRITICAL_PASS: 'ALL_CRITICAL_PASS',
  // DOWN
  CRITICAL_FUNCTION_FAILED: 'CRITICAL_FUNCTION_FAILED',
  OPEN_CRITICAL_FAULT: 'OPEN_CRITICAL_FAULT',
  // UNKNOWN
  NO_APPROVED_BASELINE: 'NO_APPROVED_BASELINE',
  CRITICAL_RESULT_MISSING: 'CRITICAL_RESULT_MISSING',
  OVERDUE_BEYOND_GRACE: 'OVERDUE_BEYOND_GRACE',
  // WATCH
  NON_CRITICAL_ISSUE: 'NON_CRITICAL_ISSUE',
  OVERDUE_WITHIN_GRACE: 'OVERDUE_WITHIN_GRACE',
} as const;

export type ReadinessReasonCode =
  (typeof READINESS_REASON)[keyof typeof READINESS_REASON];

/** Default Thai messages per reason code. `{label}` is substituted per-check. */
export const READINESS_REASON_MESSAGE_TH: Record<ReadinessReasonCode, string> = {
  ALL_CRITICAL_PASS: 'ฟังก์ชันวิกฤตล่าสุดผ่านครบและไม่มีข้อขัดข้องที่ยังไม่ปิด',
  CRITICAL_FUNCTION_FAILED: 'ฟังก์ชันวิกฤต “{label}” ไม่ผ่าน',
  OPEN_CRITICAL_FAULT: 'มีข้อขัดข้องระดับวิกฤตที่ยังไม่ปิด',
  NO_APPROVED_BASELINE: 'ยังไม่มีผลสำรวจตั้งต้นที่อนุมัติ',
  CRITICAL_RESULT_MISSING: 'ไม่มีผลตรวจล่าสุดของฟังก์ชันวิกฤต “{label}”',
  OVERDUE_BEYOND_GRACE: 'เลยกำหนดตรวจเกินระยะผ่อนผัน',
  NON_CRITICAL_ISSUE: 'มีข้อบกพร่องที่ไม่วิกฤต',
  OVERDUE_WITHIN_GRACE: 'เลยกำหนดตรวจแต่ยังอยู่ในระยะผ่อนผัน',
};
