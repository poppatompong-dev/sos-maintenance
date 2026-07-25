import { describe, expect, it } from 'vitest';
import {
  faultSeverityLabel,
  faultStatusLabel,
  groupOutcomeLabel,
  memberStateLabel,
  scheduleBatchStatusLabel,
  workOrderKindLabel,
  workOrderStatusLabel,
} from './thai-labels';

describe('groupOutcomeLabel', () => {
  it('maps every outcome code to Thai', () => {
    expect(groupOutcomeLabel('NORMAL')).toBe('ปกติ');
    expect(groupOutcomeLabel('PROBLEM')).toBe('พบปัญหา');
    expect(groupOutcomeLabel('UNTESTABLE')).toBe('ตรวจไม่ได้');
  });
  it('falls back to a safe generic Thai phrase and never echoes the raw token', () => {
    const out = groupOutcomeLabel('WAT_IS_THIS');
    expect(out).toBe('สถานะอื่น');
    expect(out).not.toContain('WAT_IS_THIS');
  });
});

describe('memberStateLabel', () => {
  it('maps every member-state code to Thai', () => {
    expect(memberStateLabel('OK')).toBe('ทำงานปกติ');
    expect(memberStateLabel('PROBLEM')).toBe('มีปัญหา');
    expect(memberStateLabel('UNTESTED')).toBe('ตรวจไม่ได้');
  });
  it('falls back safely on an unknown code', () => {
    expect(memberStateLabel('ZZZ')).toBe('สถานะอื่น');
    expect(memberStateLabel('ZZZ')).not.toContain('ZZZ');
  });
});

describe('workOrderKindLabel', () => {
  it('maps every maintenance kind to Thai', () => {
    expect(workOrderKindLabel('INITIAL_SURVEY')).toBe('สำรวจตั้งต้น');
    expect(workOrderKindLabel('WEEKLY_CENTER')).toBe('ตรวจรายสัปดาห์');
    expect(workOrderKindLabel('MONTHLY_FIELD')).toBe('ตรวจรายเดือน');
    expect(workOrderKindLabel('SEMIANNUAL_DEEP')).toBe('ตรวจราย 6 เดือน');
    expect(workOrderKindLabel('CORRECTIVE')).toBe('ซ่อมแก้ไข');
  });
  it('falls back without echoing the raw token', () => {
    expect(workOrderKindLabel('FOO')).toBe('งานอื่น');
    expect(workOrderKindLabel('FOO')).not.toContain('FOO');
  });
});

describe('workOrderStatusLabel', () => {
  it('maps every work-order status to Thai', () => {
    for (const code of ['DRAFT','PUBLISHED','ASSIGNED','IN_PROGRESS','SUBMITTED','CLOSED','REJECTED','REOPENED','CANCELLED']) {
      const out = workOrderStatusLabel(code);
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toBe(code);
    }
    expect(workOrderStatusLabel('ASSIGNED')).toBe('มอบหมายแล้ว');
    expect(workOrderStatusLabel('SUBMITTED')).toBe('รอตรวจรับ');
  });
  it('falls back safely on an unknown status', () => {
    expect(workOrderStatusLabel('XYZ')).toBe('สถานะอื่น');
  });
});

describe('scheduleBatchStatusLabel', () => {
  it('maps every batch status to Thai', () => {
    expect(scheduleBatchStatusLabel('DRAFT')).toBe('ร่าง');
    expect(scheduleBatchStatusLabel('APPROVED')).toBe('อนุมัติแล้ว');
    expect(scheduleBatchStatusLabel('PUBLISHED')).toBe('เผยแพร่แล้ว');
  });
  it('falls back safely on an unknown status', () => {
    expect(scheduleBatchStatusLabel('XYZ')).toBe('สถานะอื่น');
  });
});

describe('faultStatusLabel', () => {
  it('maps every fault status to Thai', () => {
    for (const code of ['OPEN', 'IN_REPAIR', 'RETEST', 'RESOLVED', 'REOPENED']) {
      const out = faultStatusLabel(code);
      expect(out.length).toBeGreaterThan(0);
      expect(out).not.toBe(code);
    }
  });
  it('falls back safely on an unknown status', () => {
    expect(faultStatusLabel('XYZ')).toBe('สถานะอื่น');
  });
});

describe('faultSeverityLabel', () => {
  it('maps CRITICAL/NON_CRITICAL to Thai', () => {
    expect(faultSeverityLabel('CRITICAL')).toBe('วิกฤต');
    expect(faultSeverityLabel('NON_CRITICAL')).toBe('ทั่วไป');
  });
  it('falls back safely on an unknown severity', () => {
    expect(faultSeverityLabel('XYZ')).toBe('สถานะอื่น');
  });
});
