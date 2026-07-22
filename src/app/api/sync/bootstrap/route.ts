import { getSession, requirePermission } from '@/server/auth/session';
import { getSyncBootstrap } from '@/server/queries/sync';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/sync/bootstrap — the current technician's offline work set (doc 04).
 * Requires `workorder:start`. Returns their assigned open work orders with asset
 * + checklist definitions for offline caching.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = requirePermission(await getSession(req), 'workorder:start');
    const bootstrap = await getSyncBootstrap(session.userId, new Date());
    return json(bootstrap);
  } catch (err) {
    return errorResponse(err);
  }
}
