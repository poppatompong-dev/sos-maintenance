import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  calendarDateToUtc,
  daysInMonth,
  isLeapYear,
  nextDueDate,
  nextWorkingDay,
  nextWorkingDueDate,
  toISODate,
  weekdayOf,
  type CalendarDate,
} from './index';

const d = (year: number, month: number, day: number): CalendarDate => ({
  year,
  month,
  day,
});

describe('calendar helpers', () => {
  it('detects leap years', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });

  it('knows days in month incl. February leap', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe('nextDueDate', () => {
  it('weekly adds 7 days', () => {
    expect(nextDueDate(d(2026, 7, 21), 'WEEKLY')).toEqual(d(2026, 7, 28));
  });

  it('weekly rolls across a month boundary', () => {
    expect(nextDueDate(d(2026, 7, 28), 'WEEKLY')).toEqual(d(2026, 8, 4));
  });

  it('monthly adds one month', () => {
    expect(nextDueDate(d(2026, 7, 21), 'MONTHLY')).toEqual(d(2026, 8, 21));
  });

  it('monthly clamps to the end of a shorter month (Jan 31 -> Feb 28)', () => {
    expect(nextDueDate(d(2026, 1, 31), 'MONTHLY')).toEqual(d(2026, 2, 28));
    expect(nextDueDate(d(2024, 1, 31), 'MONTHLY')).toEqual(d(2024, 2, 29));
  });

  it('semiannual adds six months and rolls the year', () => {
    expect(nextDueDate(d(2026, 9, 15), 'SEMIANNUAL')).toEqual(d(2027, 3, 15));
  });

  it('NONE has no next due', () => {
    expect(nextDueDate(d(2026, 7, 21), 'NONE')).toBeNull();
  });

  it('addCalendarMonths handles a full-year multiple', () => {
    expect(addCalendarMonths(d(2026, 3, 10), 12)).toEqual(d(2027, 3, 10));
  });
});

describe('working-day adjustment', () => {
  it('2026-07-21 is a Tuesday', () => {
    expect(weekdayOf(d(2026, 7, 21))).toBe(2);
  });

  it('pushes a Saturday due date to Monday', () => {
    // 2026-08-01 is a Saturday
    expect(weekdayOf(d(2026, 8, 1))).toBe(6);
    expect(nextWorkingDay(d(2026, 8, 1))).toEqual(d(2026, 8, 3));
  });

  it('skips a configured holiday as well as the weekend', () => {
    // Mon 2026-08-03 declared a holiday -> next working day is Tue 2026-08-04
    const holidays = new Set([toISODate(d(2026, 8, 3))]);
    expect(nextWorkingDay(d(2026, 8, 1), holidays)).toEqual(d(2026, 8, 4));
  });

  it('nextWorkingDueDate composes recurrence + adjustment', () => {
    // weekly from Tue 2026-07-25(Sat) ... pick anchor so due lands on weekend
    // anchor Sat 2026-07-25 + 7 = Sat 2026-08-01 -> Mon 2026-08-03
    expect(nextWorkingDueDate(d(2026, 7, 25), 'WEEKLY')).toEqual(d(2026, 8, 3));
  });
});

describe('calendarDateToUtc (Bangkok local -> UTC)', () => {
  it('midnight Bangkok is 17:00 UTC the previous day', () => {
    const utc = calendarDateToUtc(d(2026, 7, 21), 0, 0);
    expect(utc.toISOString()).toBe('2026-07-20T17:00:00.000Z');
  });

  it('09:00 Bangkok is 02:00 UTC same day', () => {
    const utc = calendarDateToUtc(d(2026, 7, 21), 9, 0);
    expect(utc.toISOString()).toBe('2026-07-21T02:00:00.000Z');
  });
});
