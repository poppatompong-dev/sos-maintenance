import { describe, expect, it } from 'vitest';
import {
  durationMs,
  formatDurationThai,
  readinessRollup,
  summarize,
  timeToAcknowledgeMs,
  timeToResolveMs,
} from './index';
import type { ReadinessStatus } from '../readiness';

const at = (iso: string) => new Date(iso);

describe('durations', () => {
  it('computes positive durations', () => {
    expect(durationMs(at('2026-07-21T09:00:00Z'), at('2026-07-21T10:30:00Z'))).toBe(
      90 * 60_000,
    );
  });

  it('returns null for missing or negative', () => {
    expect(durationMs(null, at('2026-07-21T10:00:00Z'))).toBeNull();
    expect(durationMs(at('2026-07-21T10:00:00Z'), at('2026-07-21T09:00:00Z'))).toBeNull();
  });

  it('MTTA and MTTR from work-order timestamps', () => {
    const t = {
      detectedAt: at('2026-07-21T08:00:00Z'),
      acknowledgedAt: at('2026-07-21T08:20:00Z'),
      closedAt: at('2026-07-21T11:00:00Z'),
    };
    expect(timeToAcknowledgeMs(t)).toBe(20 * 60_000);
    expect(timeToResolveMs(t)).toBe(3 * 60 * 60_000);
  });
});

describe('summarize', () => {
  it('handles an empty set', () => {
    expect(summarize([])).toEqual({
      count: 0,
      meanMs: null,
      medianMs: null,
      minMs: null,
      maxMs: null,
    });
  });

  it('computes mean/median/min/max ignoring nulls', () => {
    const s = summarize([10, 20, 30, null]);
    expect(s.count).toBe(3);
    expect(s.meanMs).toBe(20);
    expect(s.medianMs).toBe(20);
    expect(s.minMs).toBe(10);
    expect(s.maxMs).toBe(30);
  });

  it('median averages the middle two for even counts', () => {
    expect(summarize([10, 20, 30, 40]).medianMs).toBe(25);
  });
});

describe('readinessRollup', () => {
  it('counts and computes percentages', () => {
    const statuses: ReadinessStatus[] = [
      ...Array(22).fill('READY'),
      'WATCH',
      'WATCH',
      'DOWN',
      'UNKNOWN',
      'UNKNOWN',
    ];
    const r = readinessRollup(statuses);
    expect(r.total).toBe(27);
    expect(r.counts).toEqual({ READY: 22, WATCH: 2, DOWN: 1, UNKNOWN: 2 });
    expect(r.percentages.READY).toBeCloseTo(81.5, 1);
    expect(r.percentages.DOWN).toBeCloseTo(3.7, 1);
  });

  it('is all-zero for no assets (no divide-by-zero)', () => {
    const r = readinessRollup([]);
    expect(r.total).toBe(0);
    expect(r.percentages.READY).toBe(0);
  });
});

describe('formatDurationThai', () => {
  it('formats units the Thai way', () => {
    expect(formatDurationThai(null)).toBe('—');
    expect(formatDurationThai(30_000)).toBe('น้อยกว่า 1 นาที');
    expect(formatDurationThai(45 * 60_000)).toBe('45 นาที');
    expect(formatDurationThai((2 * 60 + 15) * 60_000)).toBe('2 ชม. 15 นาที');
    expect(formatDurationThai(27 * 60 * 60_000)).toBe('1 วัน 3 ชม.');
  });
});
