/**
 * Pure validation for uploaded evidence photos (ADR 0005 §Storage; doc 05
 * §Upload validation: MIME/extension/signature/size, no path traversal). The
 * declared MIME type from the client is never trusted alone — the actual file
 * bytes are sniffed for a known image signature and must agree with it.
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

/** Matches `.env.example` `UPLOAD_MAX_BYTES` default (15 MiB). */
export const DEFAULT_MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const SIGNATURES: { mimeType: AllowedAttachmentMimeType; matches: (b: Uint8Array) => boolean }[] = [
  { mimeType: 'image/jpeg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mimeType: 'image/png',
    matches: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mimeType: 'image/webp',
    matches: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // 'RIFF'
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50, // 'WEBP'
  },
];

/** Sniff the real image type from magic bytes, ignoring any client-declared MIME. Null when unrecognized. */
export function sniffImageMimeType(bytes: Uint8Array): AllowedAttachmentMimeType | null {
  return SIGNATURES.find((s) => s.matches(bytes))?.mimeType ?? null;
}

export type AttachmentValidation =
  | { ok: true; mimeType: AllowedAttachmentMimeType }
  | { ok: false; reason: string };

/**
 * Validate an upload before it's ever written to storage. Rejects on: size over
 * the cap, unrecognized/disallowed signature, or a declared MIME that disagrees
 * with the sniffed one (spoofing attempt) — every case doc 05 §17 calls out.
 */
export function validateAttachmentUpload(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  sizeBytes: number;
  maxBytes?: number;
}): AttachmentValidation {
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES;
  if (input.sizeBytes <= 0) {
    return { ok: false, reason: 'ไฟล์ว่างเปล่า' };
  }
  if (input.sizeBytes > maxBytes) {
    return { ok: false, reason: `ไฟล์ใหญ่เกินกำหนด (สูงสุด ${Math.floor(maxBytes / (1024 * 1024))} MB)` };
  }
  const sniffed = sniffImageMimeType(input.bytes);
  if (!sniffed) {
    return { ok: false, reason: 'ไม่รองรับชนิดไฟล์นี้ — อัปโหลดได้เฉพาะรูปภาพ JPEG, PNG หรือ WebP' };
  }
  if (sniffed !== input.declaredMimeType) {
    return { ok: false, reason: 'ชนิดไฟล์ที่ระบุไม่ตรงกับเนื้อไฟล์จริง' };
  }
  return { ok: true, mimeType: sniffed };
}

/** File extension for a validated attachment MIME type — used to build the opaque storage key. */
export function extensionFor(mimeType: AllowedAttachmentMimeType): string {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mimeType];
}
