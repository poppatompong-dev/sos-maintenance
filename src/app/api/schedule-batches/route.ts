import { z } from 'zod';
import { getSession, requirePermission } from '@/server/auth/session';
import { createPrismaSchedulePort } from '@/server/adapters/prisma-schedule-port';
import { createScheduleBatch } from '@/server/services/create-schedule-batch';
import { listScheduleBatches } from '@/server/queries/schedule-batches';
import { errorResponse, json } from '@/server/http/respond';

/**
 * /api/schedule-batches
 *  GET  — list batches (asset:read)
 *  POST — create a DRAFT batch from a plan, generating one DRAFT work order per
 *         active asset of the plan's type (schedule:create)
 */
export const dynamic = 'force-dynamic';

const port = createPrismaSchedulePort();

const createSchema = z.object({
  planId: z.string().min(1),
  name: z.string().min(1).max(200),
  scheduledFor: z.coerce.date().optional(),
  dueAt: z.coerce.date().optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'asset:read');
    const batches = await listScheduleBatches();
    return json({ batches, count: batches.length });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = requirePermission(await getSession(req), 'schedule:create');
    const body = createSchema.parse(await req.json());
    const result = await createScheduleBatch(port, {
      planId: body.planId,
      name: body.name,
      scheduledFor: body.scheduledFor ?? null,
      dueAt: body.dueAt ?? null,
      actor: session,
      now: new Date(),
    });
    return json(result, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
