import { describe, expect, it } from 'vitest';
import { SOS_POLES } from './sos-poles';

// Nakhon Sawan municipality bounding box (generous) — a guard against a
// fat-fingered coordinate swap or a decimal-point slip in the registry.
const LON = { min: 100.0, max: 100.2 };
const LAT = { min: 15.6, max: 15.75 };

describe('SOS pole seed registry (doc 08)', () => {
  it('contains exactly 27 poles', () => {
    expect(SOS_POLES).toHaveLength(27);
  });

  it('has sequential unique codes EP01..EP27', () => {
    const codes = SOS_POLES.map((p) => p.code);
    expect(new Set(codes).size).toBe(27);
    const expected = Array.from(
      { length: 27 },
      (_, i) => `EP${String(i + 1).padStart(2, '0')}`,
    );
    expect(codes).toEqual(expected);
  });

  it('has a non-empty Thai name for every pole', () => {
    for (const p of SOS_POLES) {
      expect(p.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps every coordinate within the Nakhon Sawan bounding box', () => {
    for (const p of SOS_POLES) {
      expect(p.longitude, `${p.code} lon`).toBeGreaterThanOrEqual(LON.min);
      expect(p.longitude, `${p.code} lon`).toBeLessThanOrEqual(LON.max);
      expect(p.latitude, `${p.code} lat`).toBeGreaterThanOrEqual(LAT.min);
      expect(p.latitude, `${p.code} lat`).toBeLessThanOrEqual(LAT.max);
    }
  });

  it('stores coordinates as [longitude, latitude] (lon > lat here)', () => {
    // In Nakhon Sawan lon(~100) is always greater than lat(~15.7); a swapped
    // pair would flip this invariant.
    for (const p of SOS_POLES) {
      expect(p.longitude, p.code).toBeGreaterThan(p.latitude);
    }
  });
});
