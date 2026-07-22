import { z } from 'zod';
import { getSession, requirePermission } from '@/server/auth/session';
import { listFaults } from '@/server/queries/faults';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/faults — fault list (doc 08). Requires `fault:read`. Defaults to
 * unresolved faults; optional `status` query param overrides.
 */
export const dynamic = 'force-dynamic';

const statusSchema = z
  .enum(['OPEN', 'IN_REPAIR', 'RETEST', 'RESOLVED', 'REOPENED'])
  .optional();

export async function GET(req: Request): Promise<Response> {
  try {
    requirePermission(await getSession(req), 'fault:read');
    const status = statusSchema.parse(
      new URL(req.url).searchParams.get('status') ?? undefined,
    );
    const faults = await listFaults({ status });
    return json({ faults, count: faults.length });
  } catch (err) {
    return errorResponse(err);
  }
}
