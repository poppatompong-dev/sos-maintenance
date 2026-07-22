import Link from 'next/link';
import { AppRail } from '@/components/AppRail';
import { StatusBadge } from '@/components/StatusBadge';
import { MapPinIcon, AlertTriangleIcon, ClipboardIcon } from '@/components/icons';
import { getAssetDetail, type AssetDetail } from '@/server/queries/assets';
import type { ReadinessStatus } from '@/domain/readiness';
import { formatThaiDate } from '@/domain/shared/thai-date';

export const dynamic = 'force-dynamic';

const KIND_TH: Record<string, string> = {
  INITIAL_SURVEY: 'สำรวจตั้งต้น',
  WEEKLY_CENTER: 'ตรวจรายสัปดาห์',
  MONTHLY_FIELD: 'ตรวจรายเดือน',
  SEMIANNUAL_DEEP: 'ตรวจราย 6 เดือน',
  CORRECTIVE: 'ซ่อมแก้ไข',
};

async function load(code: string): Promise<{ detail: AssetDetail | null; error: boolean }> {
  try {
    return { detail: await getAssetDetail(code), error: false };
  } catch {
    return { detail: null, error: true };
  }
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface">
      <div className="border-b border-border px-5 py-3.5">
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { detail, error } = await load(code);

  return (
    <div className="min-h-full">
      <AppRail />
      <div className="pb-16 md:pb-0 md:pl-[76px]">
        <div className="mx-auto max-w-[1200px] px-5 md:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5 md:py-6">
            <div>
              <Link href="/" className="text-xs font-medium text-brand hover:underline">
                ← กลับหน้าภาพรวม
              </Link>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {detail ? `${detail.code} · ${detail.name}` : code}
              </h1>
            </div>
            {detail && <StatusBadge status={detail.status as ReadinessStatus} />}
          </header>

          {error ? (
            <p className="py-12 text-center text-sm text-muted">
              เชื่อมต่อฐานข้อมูลไม่ได้ในขณะนี้ — ลองใหม่อีกครั้งภายหลัง
            </p>
          ) : !detail ? (
            <p className="py-12 text-center text-sm text-muted">ไม่พบเสา “{code}”</p>
          ) : (
            <div className="grid gap-5 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="flex flex-col gap-5">
                <Card title="ส่วนประกอบและฟังก์ชันวิกฤต">
                  <ul className="divide-y divide-border/70">
                    {detail.components.map((c) => (
                      <li key={c.key} className="flex items-center justify-between gap-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-ink">{c.name}</p>
                          <p className="text-xs text-muted">
                            {c.criticality === 'CRITICAL' ? 'ฟังก์ชันวิกฤต' : 'ส่วนประกอบทั่วไป'}
                          </p>
                        </div>
                        <span className="text-xs font-medium text-muted">{c.status}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card title={`ข้อขัดข้องที่ยังเปิดอยู่ (${detail.openFaults.length})`}>
                  {detail.openFaults.length === 0 ? (
                    <p className="text-sm text-muted">ไม่มีข้อขัดข้องที่ค้างอยู่</p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {detail.openFaults.map((f) => (
                        <li key={f.code} className="flex items-start gap-3 rounded-xl bg-down-tint px-3.5 py-3">
                          <AlertTriangleIcon size={18} className="mt-0.5 shrink-0 text-down-ink" />
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {f.code} · {f.symptom}
                            </p>
                            <p className="text-xs text-muted">
                              {f.severity === 'CRITICAL' ? 'วิกฤต' : 'ทั่วไป'} · {f.status} · พบเมื่อ {formatThaiDate(new Date(f.detectedAt))}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title={`ใบงานที่กำลังดำเนินการ (${detail.activeWorkOrders.length})`}>
                  {detail.activeWorkOrders.length === 0 ? (
                    <p className="text-sm text-muted">ไม่มีใบงานที่กำลังดำเนินการ</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {detail.activeWorkOrders.map((w) => (
                        <li key={w.code} className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5">
                          <ClipboardIcon size={16} className="shrink-0 text-muted" />
                          <span className="text-sm font-semibold text-ink">{w.code}</span>
                          <span className="text-xs text-muted">{KIND_TH[w.kind] ?? w.kind}</span>
                          <span className="ml-auto text-xs text-muted">{w.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <aside className="flex h-max flex-col gap-5">
                <Card title="ข้อมูลจุดติดตั้ง">
                  <dl className="flex flex-col gap-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">สถานะวงจรชีวิต</dt>
                      <dd className="font-medium text-ink">{detail.lifecycle}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">อนุมัติสำรวจตั้งต้น</dt>
                      <dd className="font-medium text-ink">{detail.baselineApproved ? 'แล้ว' : 'ยังไม่อนุมัติ'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="flex items-center gap-1.5 text-muted">
                        <MapPinIcon size={14} /> พิกัด
                      </dt>
                      <dd className="font-mono text-xs text-ink tabular-nums">
                        {detail.latitude.toFixed(5)}, {detail.longitude.toFixed(5)}
                      </dd>
                    </div>
                  </dl>
                </Card>

                <Card title="ความพร้อมล่าสุด">
                  {detail.latestReadiness ? (
                    <div className="flex flex-col gap-2">
                      <StatusBadge status={detail.latestReadiness.status as ReadinessStatus} size="sm" />
                      <p className="text-xs text-muted">
                        ประเมินเมื่อ {formatThaiDate(new Date(detail.latestReadiness.computedAt))} · ที่มา {detail.latestReadiness.trigger}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">ยังไม่มีผลประเมินจากหลักฐาน (ยังไม่ผ่านการสำรวจตั้งต้น)</p>
                  )}
                </Card>
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
