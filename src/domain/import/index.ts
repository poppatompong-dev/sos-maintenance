/**
 * Import validation (doc 04/08): upload → parse → preview → row validation →
 * confirm → atomic commit/rollback. This module owns parse + row validation and
 * the atomicity guard: `canCommit` is true ONLY when every row is valid, so the
 * caller never performs a silent partial overwrite.
 */

// ── CSV parsing ──────────────────────────────────────────────────────────────

/** Minimal RFC-4180-ish CSV parser: quoted fields, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface ParsedTable {
  header: string[];
  records: Record<string, string>[];
}

/** Turn parsed rows into header + trimmed records, skipping blank lines. */
export function toRecords(rows: string[][]): ParsedTable {
  if (rows.length === 0) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows
    .slice(1)
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) =>
      Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])),
    );
  return { header, records };
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface RowError {
  row: number; // 1-based data row (excludes header)
  field: string;
  message: string;
}

export interface ImportValidation {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: RowError[];
  /** Atomic guard: commit only when there are zero errors. */
  canCommit: boolean;
}

function summarize(totalRows: number, errors: RowError[]): ImportValidation {
  const rowsWithErrors = new Set(errors.map((e) => e.row));
  const errorRows = rowsWithErrors.size;
  return {
    totalRows,
    validRows: totalRows - errorRows,
    errorRows,
    errors,
    canCommit: errors.length === 0 && totalRows > 0,
  };
}

const isBlank = (v: string | undefined): boolean => !v || v.trim() === '';

/** Validate an asset-registry import (columns: code, name, longitude, latitude). */
export function validateAssetRegistryImport(
  records: readonly Record<string, string>[],
): ImportValidation {
  const errors: RowError[] = [];
  const seen = new Set<string>();

  records.forEach((rec, idx) => {
    const row = idx + 1;
    const code = rec['code'];
    if (isBlank(code)) {
      errors.push({ row, field: 'code', message: 'ต้องระบุรหัสจุด' });
    } else {
      if (!/^EP\d{2}$/.test(code)) {
        errors.push({ row, field: 'code', message: 'รูปแบบรหัสไม่ถูกต้อง (เช่น EP01)' });
      }
      if (seen.has(code)) {
        errors.push({ row, field: 'code', message: `รหัสซ้ำในไฟล์: ${code}` });
      }
      seen.add(code);
    }

    if (isBlank(rec['name'])) {
      errors.push({ row, field: 'name', message: 'ต้องระบุชื่อจุด' });
    }

    const lon = Number(rec['longitude']);
    if (isBlank(rec['longitude']) || Number.isNaN(lon)) {
      errors.push({ row, field: 'longitude', message: 'ลองจิจูดต้องเป็นตัวเลข' });
    } else if (lon < -180 || lon > 180) {
      errors.push({ row, field: 'longitude', message: 'ลองจิจูดอยู่นอกช่วง -180..180' });
    }

    const lat = Number(rec['latitude']);
    if (isBlank(rec['latitude']) || Number.isNaN(lat)) {
      errors.push({ row, field: 'latitude', message: 'ละติจูดต้องเป็นตัวเลข' });
    } else if (lat < -90 || lat > 90) {
      errors.push({ row, field: 'latitude', message: 'ละติจูดอยู่นอกช่วง -90..90' });
    }
  });

  return summarize(records.length, errors);
}

const HEALTH_STATUSES = ['ONLINE', 'OFFLINE', 'DEGRADED', 'UNKNOWN'];

/** Validate a health-observation import (columns: code, status, observedAt). */
export function validateHealthObservationImport(
  records: readonly Record<string, string>[],
): ImportValidation {
  const errors: RowError[] = [];

  records.forEach((rec, idx) => {
    const row = idx + 1;
    if (isBlank(rec['code'])) {
      errors.push({ row, field: 'code', message: 'ต้องระบุรหัสจุด' });
    }
    const status = rec['status'];
    if (isBlank(status)) {
      errors.push({ row, field: 'status', message: 'ต้องระบุสถานะ' });
    } else if (!HEALTH_STATUSES.includes(status)) {
      errors.push({
        row,
        field: 'status',
        message: `สถานะไม่ถูกต้อง (${HEALTH_STATUSES.join('/')})`,
      });
    }
    if (isBlank(rec['observedAt']) || Number.isNaN(Date.parse(rec['observedAt']))) {
      errors.push({ row, field: 'observedAt', message: 'เวลาสังเกตต้องเป็น ISO datetime' });
    }
  });

  return summarize(records.length, errors);
}
