import { describe, expect, it } from 'vitest';
import {
  gpsSchema,
  fieldInspectionPayloadSchema,
  mutationEnvelopeSchema,
} from './schemas';

describe('gpsSchema', () => {
  it('accepts valid coordinates', () => {
    expect(gpsSchema.safeParse({ lat: 15.7, lng: 100.12 }).success).toBe(true);
  });
  it('rejects out-of-range latitude', () => {
    expect(gpsSchema.safeParse({ lat: 200, lng: 100 }).success).toBe(false);
  });
});

describe('fieldInspectionPayloadSchema', () => {
  it('requires at least one group', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });

  it('accepts a valid NORMAL group payload with an optional general note', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{ groupKey: 'g_power', outcome: 'NORMAL' }],
      generalNote: 'ปกติดี',
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(true);
  });

  it('accepts a PROBLEM group with member states and a note', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{
        groupKey: 'g_audio',
        outcome: 'PROBLEM',
        members: [{ memberKey: 'm_microphone', state: 'PROBLEM' }],
        note: 'ไมค์เสีย',
      }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown outcome token', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{ groupKey: 'g', outcome: 'PASS' }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a duplicate group key', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{ groupKey: 'g_audio', outcome: 'NORMAL' }, { groupKey: 'g_audio', outcome: 'NORMAL' }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a duplicate member key within a group', () => {
    const r = fieldInspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      groups: [{
        groupKey: 'g_audio',
        outcome: 'PROBLEM',
        members: [{ memberKey: 'm_mic', state: 'OK' }, { memberKey: 'm_mic', state: 'PROBLEM' }],
        note: 'x',
      }],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });
});

describe('mutationEnvelopeSchema', () => {
  it('rejects a non-UUID mutationId', () => {
    const r = mutationEnvelopeSchema.safeParse({
      mutationId: 'not-a-uuid',
      deviceId: 'd',
      entity: 'checklist_response',
      action: 'create',
      baseVersion: null,
      clientOccurredAt: '2026-07-21T03:00:00.000Z',
      payloadChecksum: 'x',
      payload: {},
    });
    expect(r.success).toBe(false);
  });

  it('accepts a valid envelope', () => {
    const r = mutationEnvelopeSchema.safeParse({
      mutationId: '22222222-2222-4222-8222-222222222222',
      deviceId: 'd',
      entity: 'checklist_response',
      action: 'create',
      baseVersion: 2,
      clientOccurredAt: '2026-07-21T03:00:00.000Z',
      payloadChecksum: 'x',
      payload: {},
    });
    expect(r.success).toBe(true);
  });
});
