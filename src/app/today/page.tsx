import { SyncState } from '@/components/SyncState';
import {
  ClipboardIcon,
  ListIcon,
  ScanIcon,
  BellIcon,
  HelpCircleIcon,
} from '@/components/icons';
import { toBangkokParts } from '@/domain/shared/bangkok';
import { formatThaiDate } from '@/domain/shared/thai-date';

export const dynamic = 'force-dynamic';

const TH_WEEKDAYS = [
  'อาทิตย์',
  'จันทร์',
  'อังคาร',
  'พุธ',
  'พฤหัสบดี',
  'ศุกร์',
  'เสาร์',
];

const BOTTOM_NAV = [
  { key: 'today', label: 'วันนี้', Icon: ListIcon, active: true },
  { key: 'scan', label: 'สแกน QR', Icon: ScanIcon, active: false },
  { key: 'mine', label: 'งานของฉัน', Icon: ClipboardIcon, active: false },
  { key: 'alerts', label: 'แจ้งเตือน', Icon: BellIcon, active: false },
];

/** Technician field-first shell (direction B): today, scan, my jobs. Mobile-first. */
export default function TodayPage() {
  const now = new Date();
  const parts = toBangkokParts(now);

  return (
    <div className="mx-auto min-h-full max-w-md bg-bg pb-24">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-sidebar text-sm font-bold text-sidebar-accent"
          >
            นว.
          </span>
          <div className="leading-tight">
            <p className="text-[0.6875rem] text-muted">เจ้าหน้าที่ภาคสนาม</p>
            <strong className="text-sm text-ink">สวัสดีตอนปฏิบัติงาน</strong>
          </div>
        </div>
        <SyncState />
      </header>

      <main className="px-4">
        {/* Hero — solid surface (no gradient). Truthful empty state. */}
        <section className="rounded-2xl bg-sidebar p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-sidebar-ink">ตารางงานของคุณ</p>
              <h1 className="mt-1.5 text-xl font-bold">
                วันนี้ยังไม่มีงานที่มอบหมาย
              </h1>
              <p className="mt-1.5 text-xs text-sidebar-ink">
                {TH_WEEKDAYS[parts.weekday]}ที่ {formatThaiDate(now)}
              </p>
            </div>
            <div className="grid shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-center">
              <span className="text-[0.625rem] text-sidebar-ink">
                {TH_WEEKDAYS[parts.weekday]}
              </span>
              <span className="text-3xl font-bold leading-none tabular-nums">
                {parts.day}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-sidebar-accent px-4 font-semibold text-[#052a25]"
          >
            <ScanIcon size={22} />
            สแกน QR เพื่อเริ่มงาน
          </button>
        </section>

        <section className="mt-6">
          <h2 className="px-1 text-sm font-semibold text-ink">ลำดับงานวันนี้</h2>
          <div className="mt-3 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-unknown-tint text-unknown-ink">
              <HelpCircleIcon size={22} />
            </span>
            <p className="font-semibold text-ink">ยังไม่มีงานที่มอบหมายวันนี้</p>
            <p className="max-w-[34ch] text-xs leading-relaxed text-muted">
              เมื่อผู้วางแผนมอบหมายและเผยแพร่งาน งานจะปรากฏที่นี่
              พร้อมดาวน์โหลดไว้ทำงานแบบออฟไลน์
            </p>
          </div>
        </section>
      </main>

      <nav
        aria-label="เมนูเจ้าหน้าที่"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-border bg-surface px-2 py-2"
      >
        {BOTTOM_NAV.map(({ key, label, Icon, active }) => (
          <a
            key={key}
            href="#"
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl text-[0.625rem] font-medium ${
              active ? 'text-brand' : 'text-muted'
            }`}
          >
            <Icon size={22} />
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
