import { z } from 'zod';
import { getSession, requirePermission } from '@/server/auth/session';
import { createPrismaRepairPort } from '@/server/adapters/prisma-repair-port';
import { recordRepair } from '@/server/services/record-repair';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/faults/:code/repair — record a repair + retest against a fault
 * (doc 04/08). Requires `repair:submit`. A passing retest resolves the fault; a
 * failing retest reopens it.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaRepairPort();

const bodySchema = z.object({
  workOrderId: z.string().min(1),
  cause: z.string().min(1).max(2000),
  fixDescription: z.string().min(1).max(4000),
  changedParts: z.string().max(2000).optional(),
  retestPassed: z.boolean(),
  retestNote: z.string().max(2000).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const session = requirePermission(await getSession(req), 'repair:submit');
    const { code } = await ctx.params;
    const body = bodySchema.parse(await req.json());

    const result = await recordRepair(port, {
      faultCode: code,
      workOrderId: body.workOrderId,
      cause: body.cause,
      fixDescription: body.fixDescription,
      changedParts: body.changedParts,
      retestPassed: body.retestPassed,
      retestNote: body.retestNote,
      actor: session,
      now: new Date(),
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
