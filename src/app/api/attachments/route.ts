import { getSession, requireAnyPermission } from '@/server/auth/session';
import { createLocalFsStoragePort } from '@/server/storage/local-fs-port';
import { uploadAttachment } from '@/server/services/upload-attachment';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/attachments — upload one evidence photo (ADR 0005; doc 05 §17).
 * multipart/form-data: `file` (image), and exactly one of
 * `checklistResponseId` / `repairActionId`, plus optional `phase`
 * ('BEFORE'|'AFTER', repair evidence only). Requires the same permission as
 * whichever action created the parent record — a technician submitting field
 * evidence (`workorder:submit`) or a repair (`repair:submit`).
 */
export const dynamic = 'force-dynamic';

const storage = createLocalFsStoragePort();

function stringField(form: FormData, key: string): string | undefined {
  const v = form.get(key);
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export async function POST(req: Request): Promise<Response> {
  try {
    requireAnyPermission(await getSession(req), ['workorder:submit', 'repair:submit']);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return json({ error: 'FILE_REQUIRED', message: 'ต้องแนบไฟล์รูปภาพ' }, 400);
    }
    const phaseRaw = stringField(form, 'phase');
    const phase = phaseRaw === 'BEFORE' || phaseRaw === 'AFTER' ? phaseRaw : undefined;

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadAttachment(storage, {
      bytes,
      declaredMimeType: file.type,
      originalName: file instanceof File ? file.name : 'photo',
      checklistResponseId: stringField(form, 'checklistResponseId'),
      repairActionId: stringField(form, 'repairActionId'),
      phase,
    });
    return json(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
