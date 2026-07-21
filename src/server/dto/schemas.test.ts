import { describe, expect, it } from 'vitest';
import {
  gpsSchema,
  inspectionPayloadSchema,
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

describe('inspectionPayloadSchema', () => {
  it('requires at least one response', () => {
    const r = inspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      responses: [],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(false);
  });

  it('accepts a valid payload', () => {
    const r = inspectionPayloadSchema.safeParse({
      workOrderId: 'wo-1',
      responses: [
        { itemCode: 'm_sos_button', label: 'ปุ่ม SOS', result: 'PASS', criticality: 'CRITICAL' },
      ],
      gps: { lat: 15.7, lng: 100.1 },
    });
    expect(r.success).toBe(true);
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
