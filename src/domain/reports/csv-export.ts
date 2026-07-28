import { readinessStatusLabel } from '@/presentation/thai-labels';
import { formatThaiDateTime } from '../shared/thai-date';
import type { ReadinessOverview } from '@/server/queries/readiness-overview';

/** Escape CSV field to handle quotes, commas, and newlines safely. */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Pure domain function to build an executive readiness CSV report (RPT-02).
 * Formats Thai column headers, official status labels, Buddhist era dates (พ.ศ.),
 * and prefixes with UTF-8 BOM (\uFEFF) to ensure Microsoft Excel opens Thai text properly.
 */
export function buildReadinessCsv(overview: ReadinessOverview): string {
  const BOM = '\uFEFF';
  const lines: string[] = [];

  // Metadata Header Rows
  lines.push(
    `# รายงานสรุปความพร้อมใช้งานเสาฉุกเฉิน SOS (เทศบาลนครนครสวรรค์)`,
  );
  lines.push(
    `# ข้อมูล ณ วันที่: ${formatThaiDateTime(overview.generatedAt)} | จำนวนเสาในระบบ: ${overview.rollup.total} จุด`,
  );
  lines.push(
    `# พร้อมใช้: ${overview.rollup.counts.READY} (${overview.rollup.percentages.READY}%) | เฝ้าระวัง: ${overview.rollup.counts.WATCH} (${overview.rollup.percentages.WATCH}%) | ใช้งานไม่ได้: ${overview.rollup.counts.DOWN} (${overview.rollup.percentages.DOWN}%) | ยังไม่ทราบ: ${overview.rollup.counts.UNKNOWN} (${overview.rollup.percentages.UNKNOWN}%)`,
  );
  lines.push('');

  // Column Headers
  const headers = [
    'รหัสเสา',
    'ชื่อสถานที่ติดตั้ง',
    'สถานะความพร้อมใช้งาน',
    'ข้อสังเกต/เหตุผลล่าสุด',
    'ละติจูด',
    'ลองจิจูด',
  ];
  lines.push(headers.map(escapeCsvField).join(','));

  // Data Rows
  for (const pole of overview.poles) {
    const row = [
      pole.code,
      pole.name,
      readinessStatusLabel(pole.status),
      pole.reason,
      pole.latitude.toFixed(6),
      pole.longitude.toFixed(6),
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  return BOM + lines.join('\r\n');
}
