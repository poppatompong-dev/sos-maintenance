import { AppRail } from '@/components/AppRail';
import { ClipboardIcon } from '@/components/icons';
import { listWorkOrders, type WorkOrderListRow } from '@/server/queries/work-orders';
import { formatThaiDate } from '@/domain/shared/thai-date';

// DB-backed; force-dynamic so no build-time DB access and always-fresh data.
export const dynamic = 'force-dynamic';

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

async function loadRows(): Promise<{ rows: WorkOrderListRow[]; error: boolean }> {
  try {
    return { rows: await listWorkOrders(), error: false };
  } catch {
    return { rows: [], error: true };
  }
}

export default async function WorkOrdersPage() {
  const { rows, error } = await loadRows();

  return (
    <div className="min-h-full">
      <AppRail />
      <div className="pb-16 md:pb-0 md:pl-[76px]">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5 md:py-6">
            <div>
              <p className="text-xs font-medium text-muted">เทศบาลนครนครสวรรค์ · ใบงานบำรุงรักษา</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">ใบงานทั้งหมด</h1>
            </div>
            <span className="text-xs text-muted tabular-nums">{rows.length} ใบงาน</span>
          </header>

          <div className="py-5">
            <section className="overflow-hidden rounded-card border border-border bg-surface">
              {error ? (
                <p className="px-5 py-10 text-center text-sm text-muted">
                  เชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้ — ลองใหม่อีกครั้งภายหลัง
                </p>
              ) : rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <span className="grid size-11 place-items-center rounded-full bg-unknown-tint text-unknown-ink">
                    <ClipboardIcon size={22} />
                  </span>
                  <p className="font-semibold text-ink">ยังไม่มีใบงาน</p>
                  <p className="max-w-[40ch] text-xs leading-relaxed text-muted">
                    เมื่อผู้วางแผนสร้างและเผยแพร่แผนการตรวจ ใบงานจะปรากฏที่นี่
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">รายการใบงานบำรุงรักษาทั้งหมด</caption>
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted">
                        <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">รหัสใบงาน</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">ประเภท</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">จุด</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">สถานะ</th>
                        <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">กำหนดเสร็จ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((w) => {
                        const st = STATUS_TH[w.status] ?? { label: w.status, cls: 'bg-unknown-tint text-unknown-ink' };
                        return (
                          <tr key={w.code} className="border-b border-border/70 last:border-0 hover:bg-panel">
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
                            <td className="py-3 pr-5 pl-3 text-muted tabular-nums">
                              {w.dueAt ? formatThaiDate(w.dueAt) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
