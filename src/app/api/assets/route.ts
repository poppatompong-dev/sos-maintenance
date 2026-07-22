import { getSession, requirePermission } from '@/server/auth/session';
import { listAssets } from '@/server/queries/assets';
import { errorResponse, json } from '@/server/http/respond';

/** GET /api/assets — asset registry (doc 08). Requires `asset:read`. */
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const assets = await listAssets();
    return json({ assets, count: assets.length });
  } catch (err) {
    return errorResponse(err);
  }
}
