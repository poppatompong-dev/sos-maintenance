import { getSession, requirePermission } from '@/server/auth/session';
import { getAssetDetail } from '@/server/queries/assets';
import { errorResponse, json } from '@/server/http/respond';

/** GET /api/assets/:code — full asset detail (doc 08). Requires `asset:read`. */
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const { code } = await ctx.params;
    const detail = await getAssetDetail(code);
    if (!detail) {
      return json({ error: 'ASSET_NOT_FOUND', message: `ไม่พบทรัพย์สิน ${code}` }, 404);
    }
    return json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}
