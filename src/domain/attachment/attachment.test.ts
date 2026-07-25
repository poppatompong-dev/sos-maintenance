import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_ATTACHMENT_BYTES,
  extensionFor,
  sniffImageMimeType,
  validateAttachmentUpload,
} from './index';

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP_HEADER = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);
const GARBAGE = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // '%PDF'

describe('sniffImageMimeType', () => {
  it('recognizes JPEG, PNG, and WebP signatures', () => {
    expect(sniffImageMimeType(JPEG_HEADER)).toBe('image/jpeg');
    expect(sniffImageMimeType(PNG_HEADER)).toBe('image/png');
    expect(sniffImageMimeType(WEBP_HEADER)).toBe('image/webp');
  });

  it('returns null for an unrecognized signature', () => {
    expect(sniffImageMimeType(GARBAGE)).toBeNull();
  });
});

describe('validateAttachmentUpload', () => {
  it('accepts a valid JPEG within the size cap', () => {
    const result = validateAttachmentUpload({
      bytes: JPEG_HEADER,
      declaredMimeType: 'image/jpeg',
      sizeBytes: JPEG_HEADER.length,
    });
    expect(result).toEqual({ ok: true, mimeType: 'image/jpeg' });
  });

  it('rejects an empty file', () => {
    const result = validateAttachmentUpload({ bytes: JPEG_HEADER, declaredMimeType: 'image/jpeg', sizeBytes: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects a file over the size cap', () => {
    const result = validateAttachmentUpload({
      bytes: JPEG_HEADER,
      declaredMimeType: 'image/jpeg',
      sizeBytes: DEFAULT_MAX_ATTACHMENT_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/ใหญ่เกินกำหนด/);
  });

  it('rejects a non-image / unrecognized signature (e.g. a renamed PDF)', () => {
    const result = validateAttachmentUpload({
      bytes: GARBAGE,
      declaredMimeType: 'image/jpeg',
      sizeBytes: GARBAGE.length,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/ไม่รองรับ/);
  });

  it('rejects a spoofed declared MIME that disagrees with the real bytes', () => {
    // Real bytes are a PNG, but the client claims it's a JPEG.
    const result = validateAttachmentUpload({
      bytes: PNG_HEADER,
      declaredMimeType: 'image/jpeg',
      sizeBytes: PNG_HEADER.length,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/ไม่ตรงกับเนื้อไฟล์จริง/);
  });
});

describe('extensionFor', () => {
  it('maps each allowed MIME type to its extension', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
  });
});
