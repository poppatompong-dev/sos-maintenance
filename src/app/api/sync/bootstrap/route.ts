import { getSession, INTERNAL_ACTOR_ID, requirePermission } from '@/server/auth/session';
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
    // No-login internal mode has no per-user assignment identity, so it receives
    // every open field work order. Authenticated mode remains assignment-scoped.
    const bootstrap = await getSyncBootstrap(
      session.userId === INTERNAL_ACTOR_ID ? null : session.userId,
      new Date(),
    );
    return json(bootstrap);
  } catch (err) {
    return errorResponse(err);
  }
}
