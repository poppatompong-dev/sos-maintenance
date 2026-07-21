import { describe, expect, it } from 'vitest';
import {
  allCriticalPassed,
  toCriticalCheckResults,
  type EvaluatedResponse,
  type RequiredCriticalFunction,
} from './index';
import { evaluateReadiness } from '../readiness';
import { CRITICAL_FUNCTIONS } from '../readiness/critical-functions';

const required: RequiredCriticalFunction[] = CRITICAL_FUNCTIONS.map((c) => ({
  key: c.key,
  label: c.label,
}));

/** A full passing monthly submission across all critical functions. */
const passingResponses: EvaluatedResponse[] = CRITICAL_FUNCTIONS.map((c) => ({
  itemCode: `m_${c.key}`,
  label: `ทดสอบ${c.label}`,
  result: 'PASS',
  criticality: 'CRITICAL',
  criticalFunctionKey: c.key,
  observedAt: new Date('2026-07-21T02:00:00.000Z'),
}));

describe('toCriticalCheckResults', () => {
  it('maps a passing submission to all-PASS', () => {
    const results = toCriticalCheckResults(passingResponses, required);
    expect(results).toHaveLength(required.length);
    expect(results.every((r) => r.result === 'PASS')).toBe(true);
  });

  it('FAIL beats PASS for the same function', () => {
    const mixed: EvaluatedResponse[] = [
      { itemCode: 'a', label: 'x', result: 'PASS', criticality: 'CRITICAL', criticalFunctionKey: 'network_voip' },
      { itemCode: 'b', label: 'y', result: 'FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'network_voip' },
    ];
    const r = toCriticalCheckResults(mixed, [{ key: 'network_voip', label: 'เครือข่าย/VoIP' }]);
    expect(r[0].result).toBe('FAIL');
  });

  it('missing responses map to UNKNOWN', () => {
    const r = toCriticalCheckResults([], required);
    expect(r.every((x) => x.result === 'UNKNOWN')).toBe(true);
  });
});

describe('allCriticalPassed', () => {
  it('true only when every critical response passed', () => {
    expect(allCriticalPassed(passingResponses)).toBe(true);
    const withFail = passingResponses.map((r, i) =>
      i === 0 ? { ...r, result: 'FAIL' as const } : r,
    );
    expect(allCriticalPassed(withFail)).toBe(false);
  });
});

describe('pipeline: checklist -> critical results -> readiness', () => {
  const now = new Date('2026-07-21T03:00:00.000Z');

  it('a fully passing submission yields READY', () => {
    const criticalChecks = toCriticalCheckResults(passingResponses, required);
    const r = evaluateReadiness({
      now,
      baselineApproved: true,
      criticalChecks,
      openCriticalFault: false,
      openNonCriticalIssue: false,
      nextDueAt: new Date('2026-08-21T03:00:00.000Z'),
    });
    expect(r.status).toBe('READY');
  });

  it('a failed critical audio check yields DOWN end-to-end', () => {
    const responses = passingResponses.map((r) =>
      r.criticalFunctionKey === 'speaker_two_way_audio'
        ? { ...r, result: 'FAIL' as const }
        : r,
    );
    const criticalChecks = toCriticalCheckResults(responses, required);
    const r = evaluateReadiness({
      now,
      baselineApproved: true,
      criticalChecks,
      openCriticalFault: false,
      openNonCriticalIssue: false,
      nextDueAt: new Date('2026-08-21T03:00:00.000Z'),
    });
    expect(r.status).toBe('DOWN');
    expect(r.reasons[0].sourceRef).toBe('speaker_two_way_audio');
  });
});
