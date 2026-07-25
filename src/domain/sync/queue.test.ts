import { describe, expect, it } from 'vitest';
import { isQueueClear, nextQueueState } from './queue';

describe('nextQueueState', () => {
  it('success clears to SYNCED and drops any prior error', () => {
    const result = nextQueueState({ attempts: 2 }, { kind: 'success' });
    expect(result).toEqual({ status: 'SYNCED', attempts: 3, lastError: null });
  });

  it('already-applied (e.g. transition already happened) also clears to SYNCED', () => {
    const result = nextQueueState({ attempts: 1 }, { kind: 'already-applied' });
    expect(result.status).toBe('SYNCED');
  });

  it('network-error goes back to PENDING for a later retry, never FAILED', () => {
    const result = nextQueueState({ attempts: 0 }, { kind: 'network-error' });
    expect(result).toEqual({ status: 'PENDING', attempts: 1, lastError: null });
  });

  it('rejected moves to FAILED and keeps the server message — never auto-retried silently', () => {
    const result = nextQueueState({ attempts: 3 }, { kind: 'rejected', message: 'GPS_REASON_REQUIRED' });
    expect(result).toEqual({ status: 'FAILED', attempts: 4, lastError: 'GPS_REASON_REQUIRED' });
  });

  it('attempts always increments regardless of outcome', () => {
    const outcomes = [
      { kind: 'success' as const },
      { kind: 'already-applied' as const },
      { kind: 'network-error' as const },
      { kind: 'rejected' as const, message: 'x' },
    ];
    for (const outcome of outcomes) {
      expect(nextQueueState({ attempts: 5 }, outcome).attempts).toBe(6);
    }
  });
});

describe('isQueueClear', () => {
  it('true for an empty queue', () => {
    expect(isQueueClear([])).toBe(true);
  });

  it('true only when every entry is SYNCED', () => {
    expect(isQueueClear(['SYNCED', 'SYNCED'])).toBe(true);
    expect(isQueueClear(['SYNCED', 'PENDING'])).toBe(false);
    expect(isQueueClear(['SYNCED', 'FAILED'])).toBe(false);
  });
});
