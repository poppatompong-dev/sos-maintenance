// src/presentation/thai-labels.ts
//
// Presentation boundary: the ONLY place that turns an internal state/status code
// into Thai for the UI. It is exhaustive over each enum and returns a safe,
// generic Thai phrase for any unrecognized code — never echoing the raw token.
// Content labels (group/member display text) come from versioned data and do NOT
// pass through here. Item kinds are never rendered, so they are never mapped.

export type GroupOutcome = 'NORMAL' | 'PROBLEM' | 'UNTESTABLE';
export type MemberState = 'OK' | 'PROBLEM' | 'UNTESTED';

const GENERIC_STATE_TH = 'สถานะอื่น';
const GENERIC_KIND_TH = 'งานอื่น';

const GROUP_OUTCOME_TH: Record<GroupOutcome, string> = {
  NORMAL: 'ปกติ',
  PROBLEM: 'พบปัญหา',
  UNTESTABLE: 'ตรวจไม่ได้',
};

const MEMBER_STATE_TH: Record<MemberState, string> = {
  OK: 'ทำงานปกติ',
  PROBLEM: 'มีปัญหา',
  UNTESTED: 'ตรวจไม่ได้',
};

const WORK_ORDER_KIND_TH: Record<string, string> = {
  INITIAL_SURVEY: 'สำรวจตั้งต้น',
  WEEKLY_CENTER: 'ตรวจรายสัปดาห์',
  MONTHLY_FIELD: 'ตรวจรายเดือน',
  SEMIANNUAL_DEEP: 'ตรวจราย 6 เดือน',
  CORRECTIVE: 'ซ่อมแก้ไข',
};

const WORK_ORDER_STATUS_TH: Record<string, string> = {
  DRAFT: 'ร่าง',
  PUBLISHED: 'รอมอบหมาย',
  ASSIGNED: 'มอบหมายแล้ว',
  IN_PROGRESS: 'กำลังดำเนินการ',
  SUBMITTED: 'รอตรวจรับ',
  CLOSED: 'ปิดงานแล้ว',
  REJECTED: 'ส่งคืนแก้ไข',
  REOPENED: 'เปิดแก้ไข',
  CANCELLED: 'ยกเลิก',
};

export function groupOutcomeLabel(code: string): string {
  return GROUP_OUTCOME_TH[code as GroupOutcome] ?? GENERIC_STATE_TH;
}

export function memberStateLabel(code: string): string {
  return MEMBER_STATE_TH[code as MemberState] ?? GENERIC_STATE_TH;
}

export function workOrderKindLabel(code: string): string {
  return WORK_ORDER_KIND_TH[code] ?? GENERIC_KIND_TH;
}

export function workOrderStatusLabel(code: string): string {
  return WORK_ORDER_STATUS_TH[code] ?? GENERIC_STATE_TH;
}

const SCHEDULE_BATCH_STATUS_TH: Record<string, string> = {
  DRAFT: 'ร่าง',
  APPROVED: 'อนุมัติแล้ว',
  PUBLISHED: 'เผยแพร่แล้ว',
};

export function scheduleBatchStatusLabel(code: string): string {
  return SCHEDULE_BATCH_STATUS_TH[code] ?? GENERIC_STATE_TH;
}

const FAULT_STATUS_TH: Record<string, string> = {
  OPEN: 'เปิดอยู่',
  IN_REPAIR: 'กำลังซ่อม',
  RETEST: 'รอผล retest',
  RESOLVED: 'แก้ไขแล้ว',
  REOPENED: 'เปิดใหม่',
};

export function faultStatusLabel(code: string): string {
  return FAULT_STATUS_TH[code] ?? GENERIC_STATE_TH;
}

const FAULT_SEVERITY_TH: Record<string, string> = {
  CRITICAL: 'วิกฤต',
  NON_CRITICAL: 'ทั่วไป',
};

export function faultSeverityLabel(code: string): string {
  return FAULT_SEVERITY_TH[code] ?? GENERIC_STATE_TH;
}

const READINESS_STATUS_TH: Record<string, string> = {
  READY: 'พร้อมใช้',
  WATCH: 'เฝ้าระวัง',
  DOWN: 'ใช้งานไม่ได้',
  UNKNOWN: 'ยังไม่ทราบ',
};

export function readinessStatusLabel(code: string): string {
  return READINESS_STATUS_TH[code] ?? GENERIC_STATE_TH;
}
