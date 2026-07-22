import { z } from 'zod';
import { getSession, requirePermission } from '@/server/auth/session';
import type { Permission } from '@/domain/authz/policy';
import type { ScheduleBatchStatus } from '@/domain/schedule';
import { createPrismaSchedulePort } from '@/server/adapters/prisma-schedule-port';
import { transitionScheduleBatch } from '@/server/services/transition-schedule-batch';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/schedule-batches/:id/transition — advance a batch DRAFT→APPROVED→
 * PUBLISHED (doc 04/08). Per-target permission; the pure state machine enforces
 * valid edges and publishing releases the batch's DRAFT work orders.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaSchedulePort();

const bodySchema = z.object({ to: z.enum(['APPROVED', 'PUBLISHED']) });

const PERMISSION_BY_TARGET: Record<'APPROVED' | 'PUBLISHED', Permission> = {
  APPROVED: 'schedule:approve',
  PUBLISHED: 'schedule:publish',
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { to } = bodySchema.parse(await req.json());
    const session = requirePermission(await getSession(req), PERMISSION_BY_TARGET[to]);
    const { id } = await ctx.params;

    const result = await transitionScheduleBatch(port, {
      id,
      to: to as ScheduleBatchStatus,
      actor: session,
      now: new Date(),
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
