import { z } from 'zod';
import { getSession, requireAnyPermission } from '@/server/auth/session';
import type { Permission } from '@/domain/authz/policy';
import type { WorkOrderStatus } from '@/domain/work/types';
import { createPrismaWorkOrderPort } from '@/server/adapters/prisma-work-order-port';
import { transitionWorkOrder } from '@/server/services/transition-work-order';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/work-orders/:code/transition — advance a work order (doc 04/08).
 * Body: { to: <WorkOrderStatus>, note?: string }. The coarse permission gate
 * below just filters roles with no business here; the fine rules (valid edge,
 * separation of duties, PM self-close) are enforced by the domain state machine.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaWorkOrderPort();

const bodySchema = z.object({
  to: z.enum([
    'PUBLISHED',
    'ASSIGNED',
    'IN_PROGRESS',
    'SUBMITTED',
    'CLOSED',
    'REJECTED',
    'REOPENED',
    'CANCELLED',
  ]),
  note: z.string().max(2000).optional(),
});

// Which permission(s) may even attempt each target status. CLOSED is reachable
// by a Planner accepting OR a Technician self-closing a passing PM.
const PERMISSIONS_BY_TARGET: Record<WorkOrderStatus, Permission[]> = {
  DRAFT: ['workorder:cancel'],
  PUBLISHED: ['workorder:assign'],
  ASSIGNED: ['workorder:assign'],
  IN_PROGRESS: ['workorder:start'],
  SUBMITTED: ['workorder:submit'],
  CLOSED: ['workorder:accept', 'workorder:submit'],
  REJECTED: ['workorder:reject'],
  REOPENED: ['workorder:reopen'],
  CANCELLED: ['workorder:cancel'],
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const { to, note } = bodySchema.parse(await req.json());
    const session = requireAnyPermission(await getSession(req), PERMISSIONS_BY_TARGET[to]);
    const { code } = await ctx.params;

    const result = await transitionWorkOrder(port, {
      code,
      to,
      actor: session,
      note,
      now: new Date(),
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
