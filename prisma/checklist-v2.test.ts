import { describe, expect, it } from 'vitest';
import { expectedFingerprint, fingerprintDefinition, V2_ITEMS, V2_GROUPS } from './checklist-v2';

describe('checklist-v2 fingerprint guard', () => {
  it('is deterministic for the canonical definition', () => {
    expect(expectedFingerprint()).toBe(fingerprintDefinition(V2_ITEMS, V2_GROUPS));
  });

  it('differs when any item field is tampered (a mismatched version would be refused)', () => {
    const tampered = V2_ITEMS.map((it, i) => (i === 0 ? { ...it, criticalFunctionKey: 'WRONG' } : it));
    expect(fingerprintDefinition(tampered, V2_GROUPS)).not.toBe(expectedFingerprint());
  });

  it('differs when an item LABEL is tampered', () => {
    const tampered = V2_ITEMS.map((it, i) => (i === 0 ? { ...it, label: 'DRIFTED' } : it));
    expect(fingerprintDefinition(tampered, V2_GROUPS)).not.toBe(expectedFingerprint());
  });

  it('differs when item ORDER changes (first two items swapped)', () => {
    const reordered = [V2_ITEMS[1], V2_ITEMS[0], ...V2_ITEMS.slice(2)];
    expect(fingerprintDefinition(reordered, V2_GROUPS)).not.toBe(expectedFingerprint());
  });

  it('differs when a group membership is tampered', () => {
    const tampered = V2_GROUPS.map((g, i) => (i === 0 ? { ...g, memberItemCodes: [...g.memberItemCodes, 'm_note'] } : g));
    expect(fingerprintDefinition(V2_ITEMS, tampered)).not.toBe(expectedFingerprint());
  });

  it('has m_note ungrouped and no duplicate membership across groups', () => {
    const memberCodes = V2_GROUPS.flatMap((g) => g.memberItemCodes);
    expect(memberCodes).not.toContain('m_note');
    expect(new Set(memberCodes).size).toBe(memberCodes.length);
  });
});
