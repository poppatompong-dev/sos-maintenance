import { z } from 'zod';
import { getSession, requirePermission } from '@/server/auth/session';
import { listWorkOrders } from '@/server/queries/work-orders';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/work-orders — work-order list (doc 08). Requires `asset:read`.
 * Optional query params: `status`, `assetCode`.
 */
export const dynamic = 'force-dynamic';

const statusSchema = z
  .enum([
    'DRAFT',
    'PUBLISHED',
    'ASSIGNED',
    'IN_PROGRESS',
    'SUBMITTED',
    'CLOSED',
    'REJECTED',
    'REOPENED',
    'CANCELLED',
  ])
  .optional();

export async function GET(req: Request): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const params = new URL(req.url).searchParams;
    const status = statusSchema.parse(params.get('status') ?? undefined);
    const assetCode = params.get('assetCode') ?? undefined;
    const workOrders = await listWorkOrders({ status, assetCode });
    return json({ workOrders, count: workOrders.length });
  } catch (err) {
    return errorResponse(err);
  }
}
