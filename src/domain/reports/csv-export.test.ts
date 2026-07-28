import { describe, expect, it } from 'vitest';
import { buildReadinessCsv } from './csv-export';
import type { ReadinessOverview } from '@/server/queries/readiness-overview';

const mockOverview: ReadinessOverview = {
  generatedAt: new Date('2026-07-28T10:00:00.000Z'),
  source: 'db',
  rollup: {
    total: 2,
    counts: { READY: 1, WATCH: 1, DOWN: 0, UNKNOWN: 0 },
    percentages: { READY: 50, WATCH: 50, DOWN: 0, UNKNOWN: 0 },
  },
  poles: [
    {
      code: 'EP01',
      name: 'อุทยานสวรรค์ ประตู 1',
      status: 'READY',
      reason: 'ฟังก์ชันวิกฤตล่าสุดผ่านครบ',
      latitude: 15.701,
      longitude: 100.1309,
    },
    {
      code: 'EP02',
      name: 'ตลาดศรีนคร',
      status: 'WATCH',
      reason: 'เกินกำหนดตรวจ (อยู่ในช่วงผ่อนผัน 7 วัน)',
      latitude: 15.705,
      longitude: 100.135,
    },
  ],
};

describe('buildReadinessCsv (RPT-02)', () => {
  it('starts with UTF-8 Byte Order Mark (BOM \\uFEFF) for Excel Thai encoding support', () => {
    const csv = buildReadinessCsv(mockOverview);
    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('includes Thai summary metadata headers', () => {
    const csv = buildReadinessCsv(mockOverview);
    expect(csv).toContain('รายงานสรุปความพร้อมใช้งานเสาฉุกเฉิน SOS');
    expect(csv).toContain('พร้อมใช้: 1 (50%)');
    expect(csv).toContain('เฝ้าระวัง: 1 (50%)');
  });

  it('includes column headers in Thai', () => {
    const csv = buildReadinessCsv(mockOverview);
    expect(csv).toContain('"รหัสเสา","ชื่อสถานที่ติดตั้ง","สถานะความพร้อมใช้งาน","ข้อสังเกต/เหตุผลล่าสุด","ละติจูด","ลองจิจูด"');
  });

  it('formats poles with official Thai status labels', () => {
    const csv = buildReadinessCsv(mockOverview);
    expect(csv).toContain('"EP01","อุทยานสวรรค์ ประตู 1","พร้อมใช้"');
    expect(csv).toContain('"EP02","ตลาดศรีนคร","เฝ้าระวัง"');
  });
});
