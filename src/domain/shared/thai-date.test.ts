import { describe, expect, it } from 'vitest';
import {
  formatBuddhistISODate,
  formatThaiDate,
  formatThaiDateTime,
  toBuddhistYear,
} from './thai-date';
import { toBangkokParts } from './bangkok';

describe('Buddhist era', () => {
  it('adds 543 to the Gregorian year', () => {
    expect(toBuddhistYear(2026)).toBe(2569);
  });
});

describe('Bangkok wall-clock', () => {
  it('shifts a UTC instant by +7h', () => {
    const p = toBangkokParts(new Date('2026-07-21T09:00:00.000Z'));
    expect(p).toMatchObject({ year: 2026, month: 7, day: 21, hour: 16, minute: 0 });
  });

  it('rolls the calendar day when UTC is late evening', () => {
    // 20:00Z on the 20th is 03:00 on the 21st in Bangkok
    const p = toBangkokParts(new Date('2026-07-20T20:00:00.000Z'));
    expect(p).toMatchObject({ year: 2026, month: 7, day: 21, hour: 3 });
  });
});

describe('Thai date formatting', () => {
  const noon = new Date('2026-07-21T09:00:00.000Z'); // 16:00 Bangkok

  it('formats a full Thai date in พ.ศ.', () => {
    expect(formatThaiDate(noon)).toBe('21 กรกฎาคม 2569');
  });

  it('formats an abbreviated Thai datetime', () => {
    expect(formatThaiDateTime(noon)).toBe('21 ก.ค. 2569 16:00 น.');
  });

  it('formats a Buddhist ISO date using the Bangkok day', () => {
    // just before Bangkok midnight boundary
    expect(formatBuddhistISODate(new Date('2026-07-20T20:00:00.000Z'))).toBe(
      '2569-07-21',
    );
  });
});
