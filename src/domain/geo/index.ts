/**
 * Geo helpers for the GPS capture rule (doc 04/08): if a technician's captured
 * position is more than 100 m from the asset, force a reason and flag the record
 * for Planner review — but still allow the capture. Distance is computed here in
 * the domain; PostGIS is used for set-based spatial queries.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8; // IUGG mean Earth radius

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in metres between two WGS84 points (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const DEFAULT_GPS_EXCEPTION_METERS = 100;

export interface GpsEvaluation {
  distanceMeters: number;
  isException: boolean;
  requiresReason: boolean;
  reviewFlag: boolean;
}

/**
 * Evaluate a captured position against the asset location. `> threshold` (strict)
 * is an exception: reason mandatory, flagged for review. Within threshold is fine.
 */
export function evaluateGpsCapture(
  asset: LatLng,
  captured: LatLng,
  thresholdMeters: number = DEFAULT_GPS_EXCEPTION_METERS,
): GpsEvaluation {
  const distanceMeters = haversineMeters(asset, captured);
  const isException = distanceMeters > thresholdMeters;
  return {
    distanceMeters,
    isException,
    requiresReason: isException,
    reviewFlag: isException,
  };
}
