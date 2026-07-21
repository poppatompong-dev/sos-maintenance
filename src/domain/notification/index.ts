/**
 * Notification message builder (doc 08). Pure construction of Thai subject/body +
 * a deterministic idempotency key so the outbox never sends the same alert twice
 * (retry-safe). Delivery (in-app / SMTP) is a separate concern.
 */
export type NotificationType =
  | 'ASSET_DOWN'
  | 'REPAIR_REJECTED'
  | 'SYNC_FAILED'
  | 'IMPORT_FAILED';

export interface BuiltNotification {
  type: NotificationType;
  subject: string;
  body: string;
  idempotencyKey: string;
}

/** Immediate alert: a pole became DOWN. Keyed to the triggering event/snapshot. */
export function buildAssetDownNotification(p: {
  assetCode: string;
  assetName: string;
  reasons: string[];
  eventId: string;
}): BuiltNotification {
  const reasonText = p.reasons.length ? p.reasons.join('; ') : 'ฟังก์ชันวิกฤตไม่ผ่าน';
  return {
    type: 'ASSET_DOWN',
    subject: `เสา ${p.assetCode} ใช้งานไม่ได้`,
    body: `เสา ${p.assetCode} (${p.assetName}) มีสถานะ “ใช้งานไม่ได้”\nเหตุผล: ${reasonText}`,
    idempotencyKey: `notif:ASSET_DOWN:${p.assetCode}:${p.eventId}`,
  };
}

/** A repair was returned to the technician for rework. */
export function buildRepairRejectedNotification(p: {
  workOrderCode: string;
  assetCode: string;
  reason: string;
  eventId: string;
}): BuiltNotification {
  return {
    type: 'REPAIR_REJECTED',
    subject: `งานซ่อม ${p.workOrderCode} ถูกส่งคืน`,
    body: `งานซ่อม ${p.workOrderCode} ของเสา ${p.assetCode} ถูกส่งคืนเพื่อแก้ไข\nเหตุผล: ${p.reason}`,
    idempotencyKey: `notif:REPAIR_REJECTED:${p.workOrderCode}:${p.eventId}`,
  };
}

/** A field sync failed and needs attention. */
export function buildSyncFailedNotification(p: {
  deviceId: string;
  mutationId: string;
}): BuiltNotification {
  return {
    type: 'SYNC_FAILED',
    subject: 'การซิงก์ข้อมูลภาคสนามล้มเหลว',
    body: `การซิงก์จากอุปกรณ์ ${p.deviceId} ล้มเหลว (mutation ${p.mutationId}) โปรดตรวจสอบ`,
    idempotencyKey: `notif:SYNC_FAILED:${p.mutationId}`,
  };
}

/** A CSV/Excel import was rejected. */
export function buildImportFailedNotification(p: {
  batchId: string;
  fileName: string;
  errorRows: number;
}): BuiltNotification {
  return {
    type: 'IMPORT_FAILED',
    subject: `นำเข้าข้อมูลไม่สำเร็จ: ${p.fileName}`,
    body: `การนำเข้าไฟล์ ${p.fileName} ไม่สำเร็จ พบ ${p.errorRows} แถวที่มีข้อผิดพลาด ระบบไม่บันทึกข้อมูลบางส่วน`,
    idempotencyKey: `notif:IMPORT_FAILED:${p.batchId}`,
  };
}
