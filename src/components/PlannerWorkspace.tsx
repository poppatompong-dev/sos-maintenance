'use client';

import { useState } from 'react';
import { WorkOrderTable, type WorkOrderRow } from '@/components/WorkOrderTable';
import { ScheduleBatchPanel, type PlanOption, type ScheduleBatchRow } from '@/components/ScheduleBatchPanel';

type Tab = 'orders' | 'batches';

export function PlannerWorkspace({
  workOrders,
  batches,
  plans,
}: {
  workOrders: WorkOrderRow[];
  batches: ScheduleBatchRow[];
  plans: PlanOption[];
}) {
  const [tab, setTab] = useState<Tab>('orders');

  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <div role="tablist" aria-label="มุมมองงาน" className="flex items-center gap-1 border-b border-border px-5 pt-3">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'orders'}
          onClick={() => setTab('orders')}
          className={`min-h-10 rounded-t-lg px-3.5 text-sm font-semibold ${
            tab === 'orders' ? 'border-b-2 border-brand text-brand' : 'text-muted hover:text-ink'
          }`}
        >
          ใบงานทั้งหมด ({workOrders.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'batches'}
          onClick={() => setTab('batches')}
          className={`min-h-10 rounded-t-lg px-3.5 text-sm font-semibold ${
            tab === 'batches' ? 'border-b-2 border-brand text-brand' : 'text-muted hover:text-ink'
          }`}
        >
          ชุดงาน ({batches.length})
        </button>
      </div>
      {tab === 'orders' ? <WorkOrderTable rows={workOrders} /> : <ScheduleBatchPanel batches={batches} plans={plans} />}
    </section>
  );
}
