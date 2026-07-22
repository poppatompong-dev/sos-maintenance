import { timingSafeEqual } from 'node:crypto';
import { createPrismaJobTickPort } from '@/server/adapters/prisma-job-tick-port';
import { runJobTick } from '@/server/services/run-job-tick';
import { errorResponse, json } from '@/server/http/respond';

/**
 * GET /api/jobs/tick — run one pass of the background jobs (doc 03). Designed for
 * a scheduler (Vercel Cron / GitHub Actions) rather than a user; it is NOT gated
 * by the RBAC session but by a shared `CRON_SECRET` presented as a Bearer token.
 * SAFE BY DEFAULT: 503 when no secret is configured, 401 on mismatch.
 */
export const dynamic = 'force-dynamic';

const port = createPrismaJobTickPort();

function timingSafeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type CronGate = 'ok' | 'unconfigured' | 'unauthorized';

function cronGate(req: Request): CronGate {
  const secret = process.env.CRON_SECRET;
  if (!secret) return 'unconfigured';
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  return timingSafeEquals(header, expected) ? 'ok' : 'unauthorized';
}

export async function GET(req: Request): Promise<Response> {
  const gate = cronGate(req);
  if (gate === 'unconfigured') {
    return json(
      { error: 'CRON_NOT_CONFIGURED', message: 'ยังไม่ได้ตั้งค่า CRON_SECRET' },
      503,
    );
  }
  if (gate === 'unauthorized') {
    return json({ error: 'UNAUTHORIZED', message: 'cron secret ไม่ถูกต้อง' }, 401);
  }
  try {
    const summary = await runJobTick(port, { now: new Date() });
    return json(summary);
  } catch (err) {
    return errorResponse(err);
  }
}
