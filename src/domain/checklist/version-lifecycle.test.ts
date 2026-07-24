import { describe, expect, it } from 'vitest';
import {
  validateChecklistVersionForPublish,
  type PublishValidationInput,
} from './version-lifecycle';

const V = 'ver-1';

function base(over: Partial<PublishValidationInput> = {}): PublishValidationInput {
  return {
    versionId: V,
    requiredCriticalFunctionKeys: ['sos_button', 'microphone'],
    items: [
      { versionId: V, code: 'm_sos_button', label: 'ปุ่ม SOS', criticalFunctionKey: 'sos_button' },
      { versionId: V, code: 'm_microphone', label: 'ไมโครโฟน', criticalFunctionKey: 'microphone' },
      { versionId: V, code: 'm_note', label: 'หมายเหตุ', criticalFunctionKey: null },
    ],
    groups: [
      { key: 'g_power', label: 'กลุ่ม A', order: 1, required: true, reasonPolicy: 'STANDARD', photoPolicy: 'NONE', members: [{ itemCode: 'm_sos_button', label: 'ปุ่ม SOS', itemVersionId: V }] },
      { key: 'g_audio', label: 'กลุ่ม B', order: 2, required: true, reasonPolicy: 'STANDARD', photoPolicy: 'NONE', members: [{ itemCode: 'm_microphone', label: 'ไมโครโฟน', itemVersionId: V }] },
    ],
    ...over,
  };
}

describe('validateChecklistVersionForPublish', () => {
  it('accepts a well-formed monthly draft', () => {
    expect(validateChecklistVersionForPublish(base()).ok).toBe(true);
  });

  it('rejects duplicate group keys', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [g[0], { ...g[1], key: 'g_power' }] }));
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate group order', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [g[0], { ...g[1], order: 1 }] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a required group with no members', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [] }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a membership referencing an item not in this version', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [{ itemCode: 'ghost', label: 'x', itemVersionId: V }] }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a cross-version member even when a same-code item exists in this version', () => {
    // m_sos_button exists in this version, but this membership references an item
    // of a DIFFERENT version with the same code — must be rejected factually.
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [{ itemCode: 'm_sos_button', label: 'ปุ่ม SOS', itemVersionId: 'other-ver' }] }, g[1]] }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('คนละเวอร์ชัน');
  });

  it('rejects an empty group label', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], label: '  ' }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects an empty member label', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], members: [{ itemCode: 'm_sos_button', label: '', itemVersionId: V }] }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects when the members do not cover a required critical function', () => {
    const r = validateChecklistVersionForPublish(base({ requiredCriticalFunctionKeys: ['sos_button', 'microphone', 'camera_recording'] }));
    expect(r.ok).toBe(false);
  });

  it('rejects an unrecognized reason policy', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], reasonPolicy: 'WHATEVER' }, g[1]] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a non-NONE photo policy in this slice', () => {
    const g = base().groups;
    const r = validateChecklistVersionForPublish(base({ groups: [{ ...g[0], photoPolicy: 'REQUIRED' }, g[1]] }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).not.toContain('undefined');
  });
});
