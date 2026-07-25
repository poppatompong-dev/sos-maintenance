import { AppRail } from '@/components/AppRail';
import { PlannerWorkspace } from '@/components/PlannerWorkspace';
import { listWorkOrders } from '@/server/queries/work-orders';
import { listScheduleBatches } from '@/server/queries/schedule-batches';
import { listActivePlans } from '@/server/queries/maintenance-plans';

// DB-backed; force-dynamic so no build-time DB access and always-fresh data.
export const dynamic = 'force-dynamic';

async function loadWorkspace() {
  try {
    const [workOrderRows, batchRows, planRows] = await Promise.all([
      listWorkOrders(),
      listScheduleBatches(),
      listActivePlans(),
    ]);
    return {
      workOrders: workOrderRows.map((w) => ({
        code: w.code,
        kind: w.kind,
        status: w.status,
        assetCode: w.assetCode,
        dueAt: w.dueAt ? w.dueAt.toISOString() : null,
      })),
      batches: batchRows.map((b) => ({
        id: b.id,
        name: b.name,
        status: b.status,
        planKind: b.planKind,
        planName: b.planName,
        workOrderCount: b.workOrderCount,
        createdAt: b.createdAt.toISOString(),
        approvedAt: b.approvedAt ? b.approvedAt.toISOString() : null,
        publishedAt: b.publishedAt ? b.publishedAt.toISOString() : null,
      })),
      plans: planRows.map((p) => ({ id: p.id, name: p.name, kind: p.kind, assetTypeKey: p.assetTypeKey })),
      error: false as const,
    };
  } catch {
    return { workOrders: [], batches: [], plans: [], error: true as const };
  }
}

export default async function WorkOrdersPage() {
  const { workOrders, batches, plans, error } = await loadWorkspace();

  return (
    <div className="min-h-full">
      <AppRail current="work" />
      <div className="pb-16 md:pb-0 md:pl-[76px]">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5 md:py-6">
            <div>
              <p className="text-xs font-medium text-muted">เทศบาลนครนครสวรรค์ · ใบงานบำรุงรักษา</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">ใบงานและชุดงาน</h1>
            </div>
            <span className="text-xs text-muted tabular-nums">{workOrders.length} ใบงาน · {batches.length} ชุดงาน</span>
          </header>

          <div className="py-5">
            {error ? (
              <section className="overflow-hidden rounded-card border border-border bg-surface">
                <p className="px-5 py-10 text-center text-sm text-muted">
                  เชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้ — ลองใหม่อีกครั้งภายหลัง
                </p>
              </section>
            ) : (
              <PlannerWorkspace workOrders={workOrders} batches={batches} plans={plans} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
