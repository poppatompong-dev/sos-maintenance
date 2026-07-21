/**
 * Asia/Bangkok is UTC+7 with no DST, so timezone math is a fixed offset. Storage
 * is always UTC (doc 04); these helpers convert at the domain/presentation edge.
 */
export const BANGKOK_OFFSET_MINUTES = 420; // UTC+7

export interface BangkokParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=Sun … 6=Sat
}

/** Wall-clock parts of `instant` as seen in Bangkok. */
export function toBangkokParts(instant: Date): BangkokParts {
  const shifted = new Date(instant.getTime() + BANGKOK_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

/** The UTC instant corresponding to a Bangkok local wall-clock time. */
export function bangkokToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(asIfUtc - BANGKOK_OFFSET_MINUTES * 60_000);
}
