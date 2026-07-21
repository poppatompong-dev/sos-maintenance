import { describe, expect, it } from 'vitest';
import {
  buildAssetDownNotification,
  buildImportFailedNotification,
  buildRepairRejectedNotification,
  buildSyncFailedNotification,
} from './index';

describe('buildAssetDownNotification', () => {
  it('names the pole and reason, keyed to the event', () => {
    const n = buildAssetDownNotification({
      assetCode: 'EP06',
      assetName: 'หน้าประตู 8',
      reasons: ['ฟังก์ชันวิกฤต “เสียงสองทาง” ไม่ผ่าน'],
      eventId: 'snap-1',
    });
    expect(n.subject).toContain('EP06');
    expect(n.subject).toContain('ใช้งานไม่ได้');
    expect(n.body).toContain('เสียงสองทาง');
    expect(n.idempotencyKey).toBe('notif:ASSET_DOWN:EP06:snap-1');
  });

  it('same event ⇒ same key (retry-safe); different event ⇒ different key', () => {
    const base = { assetCode: 'EP06', assetName: 'x', reasons: [] };
    const a = buildAssetDownNotification({ ...base, eventId: 'e1' });
    const b = buildAssetDownNotification({ ...base, eventId: 'e1' });
    const c = buildAssetDownNotification({ ...base, eventId: 'e2' });
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.idempotencyKey).not.toBe(c.idempotencyKey);
  });
});

describe('other notifications', () => {
  it('repair rejected includes work order + reason', () => {
    const n = buildRepairRejectedNotification({
      workOrderCode: 'WO-2026-0142',
      assetCode: 'EP06',
      reason: 'รูปหลักฐานไม่ครบ',
      eventId: 'r1',
    });
    expect(n.subject).toContain('WO-2026-0142');
    expect(n.body).toContain('รูปหลักฐานไม่ครบ');
    expect(n.idempotencyKey).toBe('notif:REPAIR_REJECTED:WO-2026-0142:r1');
  });

  it('sync failed is keyed by mutation', () => {
    const n = buildSyncFailedNotification({ deviceId: 'dev-1', mutationId: 'm-9' });
    expect(n.idempotencyKey).toBe('notif:SYNC_FAILED:m-9');
  });

  it('import failed reports the error-row count', () => {
    const n = buildImportFailedNotification({
      batchId: 'b-1',
      fileName: 'assets.csv',
      errorRows: 3,
    });
    expect(n.body).toContain('3 แถว');
    expect(n.idempotencyKey).toBe('notif:IMPORT_FAILED:b-1');
  });
});
