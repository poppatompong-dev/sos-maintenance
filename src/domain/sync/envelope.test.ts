import { describe, expect, it } from 'vitest';
import {
  detectVersionConflict,
  isDuplicateMutation,
  validateEnvelope,
  type MutationEnvelope,
} from './envelope';

const good: MutationEnvelope = {
  mutationId: '11111111-1111-4111-8111-111111111111',
  deviceId: 'device-a',
  entity: 'checklist_response',
  action: 'create',
  baseVersion: 3,
  clientOccurredAt: '2026-07-21T02:00:00.000Z',
  payloadChecksum: 'abc123',
  payload: {},
};

describe('validateEnvelope', () => {
  it('accepts a well-formed envelope', () => {
    expect(validateEnvelope(good).valid).toBe(true);
  });

  it('reports each structural problem', () => {
    const bad = { ...good, mutationId: '', action: 'delete' as never, clientOccurredAt: 'nope' };
    const r = validateEnvelope(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('idempotency', () => {
  it('detects an already-processed mutation', () => {
    const processed = new Set([good.mutationId]);
    expect(isDuplicateMutation(good.mutationId, processed)).toBe(true);
    expect(isDuplicateMutation('other', processed)).toBe(false);
  });
});

describe('optimistic concurrency', () => {
  it('no conflict when versions match', () => {
    expect(detectVersionConflict(3, 3).conflict).toBe(false);
  });

  it('conflict when base version is stale (no silent overwrite)', () => {
    const r = detectVersionConflict(3, 5);
    expect(r.conflict).toBe(true);
    expect(r.serverVersion).toBe(5);
    expect(r.baseVersion).toBe(3);
  });

  it('fresh create (null base) never conflicts', () => {
    expect(detectVersionConflict(null, 9).conflict).toBe(false);
  });
});
