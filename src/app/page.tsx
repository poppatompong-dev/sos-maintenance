import { AppRail } from '@/components/AppRail';
import { StatusRail } from '@/components/StatusRail';
import { PoleTable } from '@/components/PoleTable';
import {
  BellIcon,
  ClipboardIcon,
  HelpCircleIcon,
  MapPinIcon,
} from '@/components/icons';
import { getReadinessOverview } from '@/server/queries/readiness-overview';
import { formatThaiDateTime } from '@/domain/shared/thai-date';

// Rendered per request so "data as of" reflects the real time (and no build-time
// clock is baked in). Swaps to DB-backed data in Sprint 4.
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const overview = getReadinessOverview(new Date());
  const needSurvey = overview.rollup.counts.UNKNOWN;

  return (
    <div className="min-h-full">
      <AppRail />

      <div className="pb-16 md:pb-0 md:pl-[76px]">
        <div className="mx-auto max-w-[1440px] px-5 md:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-5 md:py-6">
            <div>
              <p className="text-xs font-medium text-muted">
                เทศบาลนครนครสวรรค์ · Smart Safety Zone
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                ศูนย์ควบคุมเสา SOS
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="size-2 rounded-full bg-ready" aria-hidden="true" />
                ข้อมูล ณ {formatThaiDateTime(overview.generatedAt)}
              </span>
              <button
                type="button"
                aria-label="การแจ้งเตือน"
                className="grid size-10 place-items-center rounded-xl border border-border bg-surface text-muted hover:text-ink"
              >
                <BellIcon size={18} />
              </button>
            </div>
          </header>

          <div className="py-5">
            <StatusRail rollup={overview.rollup} />
          </div>

          <div className="grid gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="overflow-hidden rounded-card border border-border bg-surface">
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-semibold text-ink">สถานะเสาทั้ง {overview.poles.length} จุด</h2>
                  <p className="mt-0.5 text-xs text-muted">
                    เรียงตามรหัสจุด · มุมมองรายการ (ใช้แทนแผนที่)
                  </p>
                </div>
                <span className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted sm:inline-flex">
                  <MapPinIcon size={14} />
                  แผนที่แสดงเมื่อออนไลน์
                </span>
              </div>
              <PoleTable poles={overview.poles} />
            </section>

            <aside className="h-max rounded-card border border-border bg-surface">
              <div className="border-b border-border px-5 py-4">
                <h2 className="font-semibold text-ink">ต้องดำเนินการ</h2>
                <p className="mt-0.5 text-xs text-muted">เรียงตามความเร่งด่วน</p>
              </div>
              <div className="px-5 py-5">
                <div className="flex items-start gap-3 rounded-xl bg-unknown-tint px-4 py-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-unknown-ink">
                    <HelpCircleIcon size={18} />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">
                      ยังไม่มีเสาใดผ่านการสำรวจตั้งต้น
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      เริ่มสำรวจตั้งต้นเพื่อให้ระบบคำนวณความพร้อมจากหลักฐาน
                      ทั้ง {needSurvey} จุดจึงยังแสดงสถานะ “ยังไม่ทราบ”
                    </p>
                  </div>
                </div>
                <a
                  href="#"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-strong"
                >
                  <ClipboardIcon size={17} />
                  เริ่มสำรวจตั้งต้น
                </a>
                <p className="mt-3 text-center text-xs text-muted tabular-nums">
                  {needSurvey} จุดรอการสำรวจ
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
