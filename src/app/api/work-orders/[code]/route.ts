import { getSession, requirePermission } from '@/server/auth/session';
import { getWorkOrderDetail } from '@/server/queries/work-order-detail';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/work-orders/:code — single work-order detail (doc 08). Requires
 * `asset:read`. Includes the linked fault + latest repair evidence for
 * corrective work orders, so a Planner can review before accepting/rejecting.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const { code } = await ctx.params;
    const detail = await getWorkOrderDetail(code);
    if (!detail) {
      return json({ error: 'WORKORDER_NOT_FOUND', message: `ไม่พบใบงาน ${code}` }, 404);
    }
    return json(detail);
  } catch (err) {
    return errorResponse(err);
  }
}
