import { toBangkokParts } from './bangkok';

/**
 * Thai display formatting: dates are shown to users in the Buddhist era (พ.ศ.)
 * and Bangkok time, while timestamps are stored/compared in UTC (doc 04/08).
 */
const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const TH_MONTHS_ABBR = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** Gregorian year -> Buddhist era. */
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

/** "21 กรกฎาคม 2569" (full month, พ.ศ., Bangkok date). */
export function formatThaiDate(instant: Date): string {
  const p = toBangkokParts(instant);
  return `${p.day} ${TH_MONTHS[p.month - 1]} ${toBuddhistYear(p.year)}`;
}

/** "21 ก.ค. 2569 16:00 น." (abbreviated month + time). */
export function formatThaiDateTime(instant: Date): string {
  const p = toBangkokParts(instant);
  const hh = String(p.hour).padStart(2, '0');
  const mm = String(p.minute).padStart(2, '0');
  return `${p.day} ${TH_MONTHS_ABBR[p.month - 1]} ${toBuddhistYear(p.year)} ${hh}:${mm} น.`;
}

/** Buddhist-era ISO-like date "2569-07-21" (Bangkok calendar day). */
export function formatBuddhistISODate(instant: Date): string {
  const p = toBangkokParts(instant);
  return `${toBuddhistYear(p.year)}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
