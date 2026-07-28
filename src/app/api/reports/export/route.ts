import { getSession, requireAnyPermission } from '@/server/auth/session';
import { loadReadinessOverview } from '@/server/queries/readiness-overview';
import { buildReadinessCsv } from '@/domain/reports/csv-export';
import { errorResponse, json } from '@/server/http/respond';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/export — Export executive readiness report as CSV (doc 08 UAT 9 & 10).
 * Gated by RBAC: `report:export`, `report:read`, or `asset:read`. Executive read-only.
 * Returns UTF-8 BOM CSV by default, or JSON when `format=json`.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getSession(req);
    requireAnyPermission(session, ['report:export', 'report:read', 'asset:read']);

    const now = new Date();
    const overview = await loadReadinessOverview(now);
    const url = new URL(req.url);
    const format = url.searchParams.get('format') ?? 'csv';

    if (format === 'json') {
      return json(overview);
    }

    const csvContent = buildReadinessCsv(overview);
    const dateStr = now.toISOString().slice(0, 10);
    const filename = `sos-readiness-report-${dateStr}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
