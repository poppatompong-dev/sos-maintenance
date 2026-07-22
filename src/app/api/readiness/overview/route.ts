import { getSession, requirePermission } from '@/server/auth/session';
import { loadReadinessOverview } from '@/server/queries/readiness-overview';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/readiness/overview — control-centre readiness rollup (doc 08 §Interface).
 * Any authenticated role with `asset:read` may read it. DB-backed with seed
 * fallback (see readiness-overview.ts).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getSession(req);
    requirePermission(session, 'asset:read');
    const overview = await loadReadinessOverview(new Date());
    return json(overview);
  } catch (err) {
    return errorResponse(err);
  }
}
