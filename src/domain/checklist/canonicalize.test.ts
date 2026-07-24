import { describe, expect, it } from 'vitest';
import {
  canonicalizeFieldSubmission,
  FieldSubmissionError,
  type CanonicalizeInput,
} from './canonicalize';

/** A minimal monthly-like version: one critical group + one note item. */
function baseInput(over: Partial<CanonicalizeInput['submission']> = {}): CanonicalizeInput {
  return {
    groups: [
      { key: 'g_audio', required: true, memberItemCodes: ['m_microphone', 'm_speaker_two_way_audio'] },
    ],
    items: [
      { code: 'm_microphone', label: 'ไมโครโฟน', criticality: 'CRITICAL', criticalFunctionKey: 'microphone' },
      { code: 'm_speaker_two_way_audio', label: 'ลำโพง/เสียงสองทาง', criticality: 'CRITICAL', criticalFunctionKey: 'speaker_two_way_audio' },
      { code: 'm_note', label: 'หมายเหตุเพิ่มเติม', criticality: 'NON_CRITICAL', criticalFunctionKey: null },
    ],
    generalNoteItemCode: 'm_note',
    submission: {
      groups: [{ groupKey: 'g_audio', outcome: 'NORMAL' }],
      ...over,
    },
  };
}

describe('canonicalizeFieldSubmission', () => {
  it('NORMAL → every member PASS; criticality/function key come from item defs', () => {
    const out = canonicalizeFieldSubmission(baseInput());
    const mic = out.find((r) => r.itemCode === 'm_microphone')!;
    expect(mic.result).toBe('PASS');
    expect(mic.criticality).toBe('CRITICAL');
    expect(mic.criticalFunctionKey).toBe('microphone');
  });

  it('ignores client-supplied criticality/function keys — they are not in the input at all', () => {
    // The submission type carries only groupKey/outcome/members(state)/note/reason.
    const out = canonicalizeFieldSubmission(baseInput());
    for (const r of out.filter((x) => x.itemCode !== 'm_note')) {
      // Values are exactly what the item definition says.
      expect(['CRITICAL', 'NON_CRITICAL']).toContain(r.criticality);
    }
  });

  it('PROBLEM → OK=PASS, PROBLEM=FAIL, unset=UNKNOWN (never assumed pass); symptom note on FAIL rows', () => {
    const out = canonicalizeFieldSubmission(
      baseInput({
        groups: [
          {
            groupKey: 'g_audio',
            outcome: 'PROBLEM',
            members: [{ memberKey: 'm_microphone', state: 'PROBLEM' }],
            note: 'ไมค์ไม่มีเสียง',
          },
        ],
      }),
    );
    const mic = out.find((r) => r.itemCode === 'm_microphone')!;
    const spk = out.find((r) => r.itemCode === 'm_speaker_two_way_audio')!;
    expect(mic.result).toBe('FAIL');
    expect(mic.note).toBe('ไมค์ไม่มีเสียง');
    expect(spk.result).toBe('UNKNOWN'); // unset member is never PASS
  });

  it('UNTESTABLE → all members UNKNOWN with the reason on each row', () => {
    const out = canonicalizeFieldSubmission(
      baseInput({
        groups: [{ groupKey: 'g_audio', outcome: 'UNTESTABLE', reason: 'เข้าพื้นที่ไม่ได้' }],
      }),
    );
    expect(out.filter((r) => r.itemCode !== 'm_note').every((r) => r.result === 'UNKNOWN')).toBe(true);
    expect(out.find((r) => r.itemCode === 'm_microphone')!.note).toBe('เข้าพื้นที่ไม่ได้');
  });

  it('general note → the note item as NA carrying the text', () => {
    const out = canonicalizeFieldSubmission(baseInput({ generalNote: 'ทุกอย่างปกติดี' }));
    const note = out.find((r) => r.itemCode === 'm_note')!;
    expect(note.result).toBe('NA');
    expect(note.note).toBe('ทุกอย่างปกติดี');
  });

  it('rejects an unknown group key', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'nope', outcome: 'NORMAL' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects a member key that is not in the named group', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({
          groups: [{ groupKey: 'g_audio', outcome: 'PROBLEM', members: [{ memberKey: 'm_camera_recording', state: 'PROBLEM' }], note: 'x' }],
        }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects a duplicate submitted group key (no last-wins)', () => {
    let err: unknown;
    try {
      canonicalizeFieldSubmission(
        baseInput({
          groups: [
            { groupKey: 'g_audio', outcome: 'NORMAL' },
            { groupKey: 'g_audio', outcome: 'UNTESTABLE', reason: 'x' },
          ],
        }),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FieldSubmissionError);
    expect((err as FieldSubmissionError).code).toBe('DUPLICATE_GROUP');
  });

  it('rejects a duplicate member key within a group (no last-wins)', () => {
    let err: unknown;
    try {
      canonicalizeFieldSubmission(
        baseInput({
          groups: [{
            groupKey: 'g_audio',
            outcome: 'PROBLEM',
            members: [
              { memberKey: 'm_microphone', state: 'OK' },
              { memberKey: 'm_microphone', state: 'PROBLEM' },
            ],
            note: 'x',
          }],
        }),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FieldSubmissionError);
    expect((err as FieldSubmissionError).code).toBe('DUPLICATE_MEMBER');
  });

  it('rejects a missing required group', () => {
    expect(() =>
      canonicalizeFieldSubmission(baseInput({ groups: [] })),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects PROBLEM with no member marked PROBLEM', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'g_audio', outcome: 'PROBLEM', members: [{ memberKey: 'm_microphone', state: 'OK' }], note: 'x' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects PROBLEM with an empty symptom note', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'g_audio', outcome: 'PROBLEM', members: [{ memberKey: 'm_microphone', state: 'PROBLEM' }], note: '   ' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });

  it('rejects UNTESTABLE with an empty reason', () => {
    expect(() =>
      canonicalizeFieldSubmission(
        baseInput({ groups: [{ groupKey: 'g_audio', outcome: 'UNTESTABLE', reason: '' }] }),
      ),
    ).toThrow(FieldSubmissionError);
  });
});
