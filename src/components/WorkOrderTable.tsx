'use client';

import { Fragment, useState } from 'react';
import { WorkOrderActionPanel, PLANNER_NEXT } from '@/components/WorkOrderActions';
import { ClipboardIcon } from '@/components/icons';
import { formatThaiDate } from '@/domain/shared/thai-date';

export interface WorkOrderRow {
  code: string;
  kind: string;
  status: string;
  assetCode: string;
  dueAt: string | null;
}

const KIND_TH: Record<string, string> = {
  INITIAL_SURVEY: 'สำรวจตั้งต้น',
  WEEKLY_CENTER: 'ตรวจรายสัปดาห์',
  MONTHLY_FIELD: 'ตรวจรายเดือน',
  SEMIANNUAL_DEEP: 'ตรวจราย 6 เดือน',
  CORRECTIVE: 'ซ่อมแก้ไข',
};

const STATUS_TH: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'ร่าง', cls: 'bg-unknown-tint text-unknown-ink' },
  PUBLISHED: { label: 'เผยแพร่', cls: 'bg-watch-tint text-watch-ink' },
  ASSIGNED: { label: 'มอบหมายแล้ว', cls: 'bg-watch-tint text-watch-ink' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', cls: 'bg-watch-tint text-watch-ink' },
  SUBMITTED: { label: 'ส่งตรวจรับ', cls: 'bg-watch-tint text-watch-ink' },
  CLOSED: { label: 'ปิดงาน', cls: 'bg-ready-tint text-ready-ink' },
  REJECTED: { label: 'ตีกลับ', cls: 'bg-down-tint text-down-ink' },
  REOPENED: { label: 'เปิดใหม่', cls: 'bg-down-tint text-down-ink' },
  CANCELLED: { label: 'ยกเลิก', cls: 'bg-unknown-tint text-unknown-ink' },
};

export function WorkOrderTable({ rows }: { rows: WorkOrderRow[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-unknown-tint text-unknown-ink">
          <ClipboardIcon size={22} />
        </span>
        <p className="font-semibold text-ink">ยังไม่มีใบงาน</p>
        <p className="max-w-[40ch] text-xs leading-relaxed text-muted">
          เมื่อผู้วางแผนสร้างและเผยแพร่แผนการตรวจ ใบงานจะปรากฏที่นี่
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">รายการใบงานบำรุงรักษาทั้งหมด</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">รหัสใบงาน</th>
            <th scope="col" className="px-3 py-2.5 font-medium">ประเภท</th>
            <th scope="col" className="px-3 py-2.5 font-medium">จุด</th>
            <th scope="col" className="px-3 py-2.5 font-medium">สถานะ</th>
            <th scope="col" className="px-3 py-2.5 font-medium">กำหนดเสร็จ</th>
            <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">ดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => {
            const st = STATUS_TH[w.status] ?? { label: w.status, cls: 'bg-unknown-tint text-unknown-ink' };
            const isOpen = expanded === w.code;
            const hasActions = (PLANNER_NEXT[w.status] ?? []).length > 0;
            return (
              <Fragment key={w.code}>
                <tr className="border-b border-border/70 last:border-0 hover:bg-panel">
                  <th scope="row" className="py-3 pr-3 pl-5 text-left font-semibold text-ink">{w.code}</th>
                  <td className="px-3 py-3 text-muted">{KIND_TH[w.kind] ?? w.kind}</td>
                  <td className="px-3 py-3">
                    <a href={`/assets/${w.assetCode}`} className="font-medium text-brand hover:underline">
                      {w.assetCode}
                    </a>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex w-max items-center rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-muted tabular-nums">
                    {w.dueAt ? formatThaiDate(new Date(w.dueAt)) : '—'}
                  </td>
                  <td className="py-3 pr-5 pl-3">
                    {hasActions ? (
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : w.code)}
                        className="min-h-9 rounded-lg border border-border-strong bg-surface px-3 text-xs font-semibold text-brand hover:bg-panel"
                      >
                        {isOpen ? 'ซ่อน' : 'จัดการ'}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="border-b border-border/70 last:border-0 bg-panel/40">
                    <td colSpan={6} className="px-5 py-4">
                      <WorkOrderActionPanel
                        code={w.code}
                        status={w.status}
                        kind={w.kind}
                        onClose={() => setExpanded(null)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
