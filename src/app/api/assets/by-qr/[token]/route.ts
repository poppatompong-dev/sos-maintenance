import { getSession, requirePermission } from '@/server/auth/session';
import { getAssetCodeByQrToken } from '@/server/queries/assets';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/assets/by-qr/:token — resolve a scanned QR payload (`Asset.qrToken`)
 * to the asset's business code (doc 08 §"สแกน QR เพื่อเปิด asset ที่ถูกต้อง").
 * Requires `asset:read`, same bar as every other asset read endpoint.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const { token } = await ctx.params;
    const code = await getAssetCodeByQrToken(token);
    if (!code) {
      return json({ error: 'QR_NOT_RECOGNIZED', message: 'ไม่พบเสาที่ตรงกับ QR นี้' }, 404);
    }
    return json({ code });
  } catch (err) {
    return errorResponse(err);
  }
}
