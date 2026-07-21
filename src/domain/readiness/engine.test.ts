import { describe, expect, it } from 'vitest';
import { addDays } from '../shared/date';
import { evaluateReadiness } from './engine';
import { READINESS_REASON } from './reason-codes';
import type { CriticalCheckResult, ReadinessInput } from './types';

const NOW = new Date('2026-07-21T09:00:00.000Z');

/** All required critical functions passing. */
const allPass: CriticalCheckResult[] = [
  { key: 'sos_button', label: 'ปุ่ม SOS', result: 'PASS', observedAt: NOW },
  { key: 'two_way_audio', label: 'เสียงสองทาง', result: 'PASS', observedAt: NOW },
  { key: 'camera_recording', label: 'กล้อง/บันทึกภาพ', result: 'PASS', observedAt: NOW },
  { key: 'network_voip', label: 'เครือข่าย/VoIP', result: 'PASS', observedAt: NOW },
  { key: 'operating_power', label: 'ไฟเลี้ยงระบบ', result: 'PASS', observedAt: NOW },
];

/** A healthy, in-cycle, approved asset. Individual tests override fields. */
function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    now: NOW,
    baselineApproved: true,
    criticalChecks: allPass,
    openCriticalFault: false,
    openNonCriticalIssue: false,
    nextDueAt: addDays(NOW, 3), // not yet due
    graceDays: 7,
    ...overrides,
  };
}

const codes = (r: ReturnType<typeof evaluateReadiness>) =>
  r.reasons.map((x) => x.code);

describe('evaluateReadiness — READY', () => {
  it('is READY when baseline approved, in-cycle, all critical pass, no faults', () => {
    const r = evaluateReadiness(baseInput());
    expect(r.status).toBe('READY');
    expect(codes(r)).toContain(READINESS_REASON.ALL_CRITICAL_PASS);
    expect(r.evaluatedAt).toEqual(NOW);
  });

  it('is READY exactly on the due instant (not yet overdue)', () => {
    const r = evaluateReadiness(baseInput({ nextDueAt: NOW }));
    expect(r.status).toBe('READY');
  });
});

describe('evaluateReadiness — DOWN (highest precedence)', () => {
  it('is DOWN when any critical function fails', () => {
    const checks = allPass.map((c) =>
      c.key === 'two_way_audio' ? { ...c, result: 'FAIL' as const } : c,
    );
    const r = evaluateReadiness(baseInput({ criticalChecks: checks }));
    expect(r.status).toBe('DOWN');
    expect(codes(r)).toContain(READINESS_REASON.CRITICAL_FUNCTION_FAILED);
    expect(r.reasons[0].sourceRef).toBe('two_way_audio');
  });

  it('is DOWN when an open critical fault exists', () => {
    const r = evaluateReadiness(baseInput({ openCriticalFault: true }));
    expect(r.status).toBe('DOWN');
    expect(codes(r)).toContain(READINESS_REASON.OPEN_CRITICAL_FAULT);
  });

  it('DOWN wins over missing baseline (precedence DOWN > UNKNOWN)', () => {
    const checks = allPass.map((c) =>
      c.key === 'sos_button' ? { ...c, result: 'FAIL' as const } : c,
    );
    const r = evaluateReadiness(
      baseInput({ baselineApproved: false, criticalChecks: checks }),
    );
    expect(r.status).toBe('DOWN');
  });

  it('DOWN wins over overdue-beyond-grace', () => {
    const r = evaluateReadiness(
      baseInput({
        openCriticalFault: true,
        nextDueAt: addDays(NOW, -30),
      }),
    );
    expect(r.status).toBe('DOWN');
  });
});

describe('evaluateReadiness — UNKNOWN', () => {
  it('is UNKNOWN when no approved baseline', () => {
    const r = evaluateReadiness(baseInput({ baselineApproved: false }));
    expect(r.status).toBe('UNKNOWN');
    expect(codes(r)).toContain(READINESS_REASON.NO_APPROVED_BASELINE);
  });

  it('is UNKNOWN when a required critical result is missing/unknown', () => {
    const checks = allPass.map((c) =>
      c.key === 'camera_recording' ? { ...c, result: 'UNKNOWN' as const } : c,
    );
    const r = evaluateReadiness(baseInput({ criticalChecks: checks }));
    expect(r.status).toBe('UNKNOWN');
    expect(codes(r)).toContain(READINESS_REASON.CRITICAL_RESULT_MISSING);
  });

  it('is UNKNOWN when there are no critical checks at all', () => {
    const r = evaluateReadiness(baseInput({ criticalChecks: [] }));
    expect(r.status).toBe('UNKNOWN');
    expect(codes(r)).toContain(READINESS_REASON.CRITICAL_RESULT_MISSING);
  });

  it('is UNKNOWN when overdue beyond the 7-day grace period', () => {
    // due 8 days ago -> beyond a 7-day grace
    const r = evaluateReadiness(baseInput({ nextDueAt: addDays(NOW, -8) }));
    expect(r.status).toBe('UNKNOWN');
    expect(codes(r)).toContain(READINESS_REASON.OVERDUE_BEYOND_GRACE);
  });

  it('UNKNOWN wins over a non-critical issue (precedence UNKNOWN > WATCH)', () => {
    const r = evaluateReadiness(
      baseInput({ baselineApproved: false, openNonCriticalIssue: true }),
    );
    expect(r.status).toBe('UNKNOWN');
  });
});

describe('evaluateReadiness — WATCH', () => {
  it('is WATCH with a non-critical defect but everything else healthy', () => {
    const r = evaluateReadiness(baseInput({ openNonCriticalIssue: true }));
    expect(r.status).toBe('WATCH');
    expect(codes(r)).toContain(READINESS_REASON.NON_CRITICAL_ISSUE);
  });

  it('is WATCH when overdue but still within the 7-day grace', () => {
    const r = evaluateReadiness(baseInput({ nextDueAt: addDays(NOW, -3) }));
    expect(r.status).toBe('WATCH');
    expect(codes(r)).toContain(READINESS_REASON.OVERDUE_WITHIN_GRACE);
  });
});

describe('evaluateReadiness — grace boundary (7 days)', () => {
  it('WATCH on the last day within grace, UNKNOWN one second later', () => {
    // due exactly 7 days ago -> still within grace (boundary inclusive)
    const atBoundary = evaluateReadiness(
      baseInput({ now: NOW, nextDueAt: addDays(NOW, -7) }),
    );
    expect(atBoundary.status).toBe('WATCH');

    // one second past the 7-day boundary -> UNKNOWN
    const justOver = evaluateReadiness(
      baseInput({
        now: new Date(NOW.getTime() + 1000),
        nextDueAt: addDays(NOW, -7),
      }),
    );
    expect(justOver.status).toBe('UNKNOWN');
  });

  it('honours a custom grace period', () => {
    const r = evaluateReadiness(
      baseInput({ nextDueAt: addDays(NOW, -2), graceDays: 1 }),
    );
    expect(r.status).toBe('UNKNOWN'); // 2 days overdue, 1-day grace
  });
});

describe('evaluateReadiness — determinism & purity', () => {
  it('does not mutate its input', () => {
    const input = baseInput();
    const snapshot = JSON.stringify(input);
    evaluateReadiness(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('returns the injected evaluation time', () => {
    const r = evaluateReadiness(baseInput());
    expect(r.evaluatedAt.getTime()).toBe(NOW.getTime());
  });
});
