import { describe, expect, it } from 'vitest';
import { evaluateGpsCapture, haversineMeters, type LatLng } from './index';

// metres-per-degree of latitude at the equator for the mean radius used above.
const M_PER_DEG_LAT = (Math.PI * 6_371_008.8) / 180; // ≈ 111195 m

const asset: LatLng = { lat: 15.7, lng: 100.12 };
/** A point `metres` due north of the asset. */
const north = (metres: number): LatLng => ({
  lat: asset.lat + metres / M_PER_DEG_LAT,
  lng: asset.lng,
});

describe('haversineMeters', () => {
  it('is zero for the same point', () => {
    expect(haversineMeters(asset, asset)).toBe(0);
  });

  it('measures a known north offset accurately', () => {
    expect(haversineMeters(asset, north(150))).toBeCloseTo(150, 0);
  });

  it('is symmetric', () => {
    const b = north(80);
    expect(haversineMeters(asset, b)).toBeCloseTo(haversineMeters(b, asset), 6);
  });
});

describe('evaluateGpsCapture — 100 m rule', () => {
  it('within range: no exception, no reason, no flag', () => {
    const r = evaluateGpsCapture(asset, north(50));
    expect(r.isException).toBe(false);
    expect(r.requiresReason).toBe(false);
    expect(r.reviewFlag).toBe(false);
    expect(r.distanceMeters).toBeCloseTo(50, 0);
  });

  it('beyond range: exception, reason required, review-flagged', () => {
    const r = evaluateGpsCapture(asset, north(150));
    expect(r.isException).toBe(true);
    expect(r.requiresReason).toBe(true);
    expect(r.reviewFlag).toBe(true);
  });

  it('just inside 100 m is not an exception', () => {
    expect(evaluateGpsCapture(asset, north(99)).isException).toBe(false);
  });

  it('just outside 100 m is an exception (strict >)', () => {
    expect(evaluateGpsCapture(asset, north(101)).isException).toBe(true);
  });

  it('honours a custom threshold', () => {
    expect(evaluateGpsCapture(asset, north(150), 200).isException).toBe(false);
  });
});
