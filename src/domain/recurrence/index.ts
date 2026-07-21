import { bangkokToUtc } from '../shared/bangkok';

/**
 * Pure recurrence for maintenance plans (doc 06 test list: weekly/monthly/
 * semiannual incl. holidays + Bangkok timezone). All arithmetic is on the
 * **Bangkok calendar**; convert to a UTC instant only when persisting a due time.
 */
export type PlanFrequency = 'WEEKLY' | 'MONTHLY' | 'SEMIANNUAL' | 'NONE';

/** A timezone-free calendar date in the Bangkok calendar. month is 1–12. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ];
}

export function toISODate(d: CalendarDate): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** 0=Sun … 6=Sat for a pure calendar date (TZ-independent). */
export function weekdayOf(d: CalendarDate): number {
  return new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
}

export function addCalendarDays(d: CalendarDate, days: number): CalendarDate {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day));
  t.setUTCDate(t.getUTCDate() + days);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

/** Add months, clamping the day to the target month length (Jan31 +1 ⇒ Feb28/29). */
export function addCalendarMonths(d: CalendarDate, months: number): CalendarDate {
  const zeroBased = d.month - 1 + months;
  const year = d.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12 + 1;
  const day = Math.min(d.day, daysInMonth(year, month));
  return { year, month, day };
}

/** Next due date from an anchor (last completed / schedule anchor). */
export function nextDueDate(
  anchor: CalendarDate,
  frequency: PlanFrequency,
): CalendarDate | null {
  switch (frequency) {
    case 'WEEKLY':
      return addCalendarDays(anchor, 7);
    case 'MONTHLY':
      return addCalendarMonths(anchor, 1);
    case 'SEMIANNUAL':
      return addCalendarMonths(anchor, 6);
    case 'NONE':
      return null;
  }
}

export function isWeekend(d: CalendarDate): boolean {
  const w = weekdayOf(d);
  return w === 0 || w === 6;
}

export function isHoliday(d: CalendarDate, holidays: ReadonlySet<string>): boolean {
  return holidays.has(toISODate(d));
}

/**
 * Roll forward to the next working day, skipping weekends and any holiday in the
 * provided set (Thai public holidays are configured, not hard-coded).
 */
export function nextWorkingDay(
  d: CalendarDate,
  holidays: ReadonlySet<string> = new Set(),
): CalendarDate {
  let cursor = d;
  let guard = 0;
  while ((isWeekend(cursor) || isHoliday(cursor, holidays)) && guard < 366) {
    cursor = addCalendarDays(cursor, 1);
    guard += 1;
  }
  return cursor;
}

/** Next due date already adjusted onto a working day. */
export function nextWorkingDueDate(
  anchor: CalendarDate,
  frequency: PlanFrequency,
  holidays: ReadonlySet<string> = new Set(),
): CalendarDate | null {
  const due = nextDueDate(anchor, frequency);
  return due ? nextWorkingDay(due, holidays) : null;
}

/** UTC instant for a Bangkok calendar date at a given local hour (default 00:00). */
export function calendarDateToUtc(d: CalendarDate, hour = 0, minute = 0): Date {
  return bangkokToUtc(d.year, d.month, d.day, hour, minute);
}
