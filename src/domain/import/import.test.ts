import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  toRecords,
  validateAssetRegistryImport,
  validateHealthObservationImport,
} from './index';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('code,name\nEP01,"ข้าง, ป้าย ""A"""');
    expect(rows[1]).toEqual(['EP01', 'ข้าง, ป้าย "A"']);
  });

  it('handles CRLF and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('toRecords', () => {
  it('maps header to trimmed records and skips blank lines', () => {
    const { header, records } = toRecords(
      parseCsv('code, name \nEP01, ข้างป้าย \n\nEP02,ทางขึ้น'),
    );
    expect(header).toEqual(['code', 'name']);
    expect(records).toEqual([
      { code: 'EP01', name: 'ข้างป้าย' },
      { code: 'EP02', name: 'ทางขึ้น' },
    ]);
  });
});

describe('validateAssetRegistryImport', () => {
  const good = [
    { code: 'EP01', name: 'ข้างป้ายอุทยานสวรรค์', longitude: '100.12', latitude: '15.69' },
    { code: 'EP02', name: 'ทางขึ้นสะพาน', longitude: '100.13', latitude: '15.70' },
  ];

  it('passes a clean batch and allows commit', () => {
    const r = validateAssetRegistryImport(good);
    expect(r.canCommit).toBe(true);
    expect(r.totalRows).toBe(2);
    expect(r.validRows).toBe(2);
    expect(r.errorRows).toBe(0);
  });

  it('flags missing/invalid fields with row + field', () => {
    const r = validateAssetRegistryImport([
      { code: '', name: '', longitude: 'x', latitude: '200' },
    ]);
    expect(r.canCommit).toBe(false);
    expect(r.errors.map((e) => e.field).sort()).toEqual([
      'code',
      'latitude',
      'longitude',
      'name',
    ]);
    expect(r.errors.every((e) => e.row === 1)).toBe(true);
  });

  it('detects duplicate codes within the file', () => {
    const r = validateAssetRegistryImport([...good, good[0]]);
    expect(r.canCommit).toBe(false);
    expect(r.errors.some((e) => e.message.includes('รหัสซ้ำ'))).toBe(true);
  });

  it('rejects a bad code format', () => {
    const r = validateAssetRegistryImport([
      { code: 'X1', name: 'a', longitude: '100', latitude: '15' },
    ]);
    expect(r.errors.some((e) => e.field === 'code')).toBe(true);
  });

  it('one bad row blocks the whole batch (no silent partial overwrite)', () => {
    const r = validateAssetRegistryImport([
      ...good,
      { code: 'EP03', name: '', longitude: '100', latitude: '15' },
    ]);
    expect(r.totalRows).toBe(3);
    expect(r.errorRows).toBe(1);
    expect(r.validRows).toBe(2);
    expect(r.canCommit).toBe(false);
  });
});

describe('validateHealthObservationImport', () => {
  it('passes valid rows', () => {
    const r = validateHealthObservationImport([
      { code: 'EP01', status: 'ONLINE', observedAt: '2026-07-21T02:00:00Z' },
    ]);
    expect(r.canCommit).toBe(true);
  });

  it('flags an unknown status and bad timestamp', () => {
    const r = validateHealthObservationImport([
      { code: 'EP01', status: 'BROKEN', observedAt: 'nope' },
    ]);
    expect(r.canCommit).toBe(false);
    expect(r.errors.map((e) => e.field).sort()).toEqual(['observedAt', 'status']);
  });
});
