import { getSession, requirePermission } from '@/server/auth/session';
import { listActiveTechnicians } from '@/server/queries/technicians';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/technicians — active technician roster, for the Planner's ASSIGNED
 * picker (doc 08). Requires `workorder:assign` — same bar as performing the
 * assignment itself. Real people only; see `prisma/seed.ts` for how names
 * enter this table (never invented — doc 07 §Open inputs).
 */
export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'workorder:assign');
    const technicians = await listActiveTechnicians();
    return json({ technicians });
  } catch (err) {
    return errorResponse(err);
  }
}
