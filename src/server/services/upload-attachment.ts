import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../db/client';
import type { StoragePort } from '../storage/port';
import { extensionFor, validateAttachmentUpload } from '@/domain/attachment';

/**
 * Application service: validate + persist one evidence photo (ADR 0005;
 * doc 05 §17 upload validation). Attaches to exactly one parent — a
 * `ChecklistResponse` (field-inspection evidence) or a `RepairAction`
 * (before/after repair evidence) — never both, never neither.
 */
export class AttachmentUploadError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'AttachmentUploadError';
    this.code = code;
  }
}

export interface UploadAttachmentInput {
  bytes: Buffer;
  declaredMimeType: string;
  originalName: string;
  checklistResponseId?: string;
  repairActionId?: string;
  phase?: 'BEFORE' | 'AFTER';
  capturedAt?: Date;
  maxBytes?: number;
}

export interface AttachmentRecord {
  id: string;
  entityType: string;
  entityId: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
  phase: string | null;
  createdAt: Date;
}

export async function uploadAttachment(
  storage: StoragePort,
  input: UploadAttachmentInput,
  client: PrismaClient = defaultPrisma,
): Promise<AttachmentRecord> {
  if (!input.checklistResponseId && !input.repairActionId) {
    throw new AttachmentUploadError(
      'ATTACHMENT_PARENT_REQUIRED',
      'ต้องระบุผลตรวจหรือบันทึกซ่อมที่จะแนบรูปนี้',
    );
  }
  if (input.checklistResponseId && input.repairActionId) {
    throw new AttachmentUploadError('ATTACHMENT_PARENT_AMBIGUOUS', 'แนบรูปได้ทีละรายการเท่านั้น');
  }

  const validation = validateAttachmentUpload({
    bytes: input.bytes,
    declaredMimeType: input.declaredMimeType,
    sizeBytes: input.bytes.byteLength,
    maxBytes: input.maxBytes,
  });
  if (!validation.ok) {
    throw new AttachmentUploadError('ATTACHMENT_INVALID', validation.reason);
  }

  let entityType: string;
  let entityId: string;
  if (input.checklistResponseId) {
    const parent = await client.checklistResponse.findUnique({
      where: { id: input.checklistResponseId },
      select: { id: true },
    });
    if (!parent) throw new AttachmentUploadError('PARENT_NOT_FOUND', 'ไม่พบผลตรวจที่จะแนบรูปนี้');
    entityType = 'CHECKLIST_RESPONSE';
    entityId = parent.id;
  } else {
    const parent = await client.repairAction.findUnique({
      where: { id: input.repairActionId },
      select: { id: true },
    });
    if (!parent) throw new AttachmentUploadError('PARENT_NOT_FOUND', 'ไม่พบบันทึกซ่อมที่จะแนบรูปนี้');
    entityType = 'REPAIR_ACTION';
    entityId = parent.id;
  }

  const checksumSha256 = createHash('sha256').update(input.bytes).digest('hex');
  const storageKey = `${randomUUID()}.${extensionFor(validation.mimeType)}`;
  await storage.put(storageKey, input.bytes);

  return client.attachment.create({
    data: {
      entityType,
      entityId,
      checklistResponseId: input.checklistResponseId ?? null,
      repairActionId: input.repairActionId ?? null,
      storageKey,
      originalName: input.originalName.slice(0, 255),
      mimeType: validation.mimeType,
      sizeBytes: input.bytes.byteLength,
      checksumSha256,
      phase: input.phase ?? null,
      capturedAt: input.capturedAt ?? null,
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      mimeType: true,
      sizeBytes: true,
      originalName: true,
      phase: true,
      createdAt: true,
    },
  });
}
