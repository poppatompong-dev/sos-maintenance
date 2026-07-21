import { describe, expect, it } from 'vitest';
import {
  correctiveWorkOrderKey,
  deriveFaults,
  faultKey,
  hasCriticalFault,
} from './index';
import type { EvaluatedResponse } from '../checklist';

const responses: EvaluatedResponse[] = [
  { itemCode: 'm_sos_button', label: 'ทดสอบปุ่ม SOS', result: 'PASS', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
  { itemCode: 'm_speaker', label: 'ทดสอบเสียงสองทาง', result: 'FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'speaker_two_way_audio' },
  { itemCode: 'm_exterior', label: 'สภาพภายนอก', result: 'FAIL', criticality: 'NON_CRITICAL' },
  { itemCode: 'm_note', label: 'หมายเหตุ', result: 'NA', criticality: 'NON_CRITICAL' },
];

describe('deriveFaults', () => {
  it('creates one fault per FAILED item with the right severity', () => {
    const faults = deriveFaults('wo-1', responses);
    expect(faults).toHaveLength(2);
    const critical = faults.find((f) => f.itemCode === 'm_speaker');
    expect(critical?.severity).toBe('CRITICAL');
    expect(critical?.sourceRef).toBe('speaker_two_way_audio');
    expect(critical?.symptom).toContain('ไม่ผ่าน');
    const nonCritical = faults.find((f) => f.itemCode === 'm_exterior');
    expect(nonCritical?.severity).toBe('NON_CRITICAL');
    expect(nonCritical?.sourceRef).toBe('m_exterior');
  });

  it('ignores PASS/NA/UNKNOWN results', () => {
    const clean = deriveFaults('wo-1', [
      { itemCode: 'a', label: 'A', result: 'PASS', criticality: 'CRITICAL' },
      { itemCode: 'b', label: 'B', result: 'NA', criticality: 'NON_CRITICAL' },
      { itemCode: 'c', label: 'C', result: 'UNKNOWN', criticality: 'CRITICAL' },
    ]);
    expect(clean).toHaveLength(0);
  });

  it('is idempotent — same keys on reprocessing', () => {
    const a = deriveFaults('wo-1', responses).map((f) => f.idempotencyKey);
    const b = deriveFaults('wo-1', responses).map((f) => f.idempotencyKey);
    expect(a).toEqual(b);
    expect(a).toContain(faultKey('wo-1', 'm_speaker'));
  });

  it('deduplicates repeated item codes', () => {
    const dup = deriveFaults('wo-1', [
      ...responses,
      { itemCode: 'm_speaker', label: 'ทดสอบเสียงสองทาง', result: 'FAIL', criticality: 'CRITICAL' },
    ]);
    expect(dup.filter((f) => f.itemCode === 'm_speaker')).toHaveLength(1);
  });

  it('keys corrective work orders deterministically off the fault', () => {
    const [fault] = deriveFaults('wo-7', [responses[1]]);
    expect(correctiveWorkOrderKey(fault)).toBe('cowo:fault:wo-7:m_speaker');
    expect(correctiveWorkOrderKey(fault)).toBe(correctiveWorkOrderKey(fault));
  });

  it('flags when any derived fault is critical', () => {
    expect(hasCriticalFault(deriveFaults('wo-1', responses))).toBe(true);
    expect(
      hasCriticalFault(
        deriveFaults('wo-1', [
          { itemCode: 'x', label: 'X', result: 'FAIL', criticality: 'NON_CRITICAL' },
        ]),
      ),
    ).toBe(false);
  });
});
