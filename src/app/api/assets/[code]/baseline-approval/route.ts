import { getSession, requireAnyPermission } from '@/server/auth/session';
import { createPrismaBaselinePort } from '@/server/adapters/prisma-baseline-port';
import { approveBaseline } from '@/server/services/approve-baseline';
import { errorResponse, json } from '@/server/http/respond';

/**
 * POST /api/assets/:code/baseline-approval — approve a pole's baseline
 * (spec 08; UAT cases 1 and 11). No body: the approval carries no operator
 * choices, only the actor and the moment. Every rule that decides whether it
 * is allowed — accepted initial survey, separation of duties, once-only —
 * lives in the domain, and the resulting readiness is recomputed, not chosen.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaBaselinePort();

export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const session = requireAnyPermission(await getSession(req), ['survey:approve']);
    const { code } = await ctx.params;

    const result = await approveBaseline(port, {
      code,
      actor: session,
      now: new Date(),
    });
    return json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
