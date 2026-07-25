import { getSession, requirePermission } from '@/server/auth/session';
import { getAttachmentMeta } from '@/server/queries/attachment';
import { createLocalFsStoragePort } from '@/server/storage/local-fs-port';
import { extensionFor, type AllowedAttachmentMimeType } from '@/domain/attachment';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/attachments/:id — authorized download (ADR 0005: private storage,
 * served only through this endpoint, safe `Content-Disposition`). Requires
 * `asset:read`, same bar as every other evidence-viewing route. The filename
 * served is derived from the id, never the client-supplied `originalName` —
 * that string is untrusted and never belongs in a response header.
 */
export const dynamic = 'force-dynamic';

const storage = createLocalFsStoragePort();

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const { id } = await ctx.params;
    const meta = await getAttachmentMeta(id);
    if (!meta) {
      return json({ error: 'ATTACHMENT_NOT_FOUND', message: 'ไม่พบไฟล์แนบ' }, 404);
    }
    const bytes = await storage.get(meta.storageKey);
    if (!bytes) {
      return json({ error: 'ATTACHMENT_NOT_FOUND', message: 'ไม่พบไฟล์แนบ' }, 404);
    }
    const ext = extensionFor(meta.mimeType as AllowedAttachmentMimeType);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'content-type': meta.mimeType,
        'content-length': String(meta.sizeBytes),
        'content-disposition': `inline; filename="attachment-${meta.id}.${ext}"`,
        'cache-control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
