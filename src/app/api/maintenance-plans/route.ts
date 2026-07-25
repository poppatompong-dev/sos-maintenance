import { getSession, requirePermission } from '@/server/auth/session';
import { listActivePlans } from '@/server/queries/maintenance-plans';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/maintenance-plans — active plan catalog (doc 08). Requires
 * `asset:read`. Feeds the schedule-batch creation form (each batch derives
 * from one plan).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const plans = await listActivePlans();
    return json({ plans, count: plans.length });
  } catch (err) {
    return errorResponse(err);
  }
}
