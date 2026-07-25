import Link from 'next/link';
import { ClipboardIcon, ListIcon, ScanIcon, BellIcon } from '@/components/icons';

export type TechnicianNavKey = 'today' | 'scan';

/** `href: null` means the destination doesn't exist yet — shown disabled, never a dead link. */
const NAV = [
  { key: 'today' as const, label: 'วันนี้', Icon: ListIcon, href: '/today' },
  { key: 'scan' as const, label: 'สแกน QR', Icon: ScanIcon, href: '/today/scan' },
  { key: 'mine' as const, label: 'งานของฉัน', Icon: ClipboardIcon, href: null },
  { key: 'alerts' as const, label: 'แจ้งเตือน', Icon: BellIcon, href: null },
];

/**
 * Technician field-first bottom nav (direction B): today, scan, my jobs, alerts.
 * `current` marks the real active item from the page that renders this — never
 * a hardcoded guess (see AppRail for the same convention on the desktop rail).
 */
export function TechnicianBottomNav({ current }: { current: TechnicianNavKey | null }) {
  return (
    <nav
      aria-label="เมนูเจ้าหน้าที่"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-center justify-around border-t border-border bg-surface px-2 py-2"
    >
      {NAV.map(({ key, label, Icon, href }) => {
        const active = key === current;
        if (!href) {
          return (
            <span
              key={key}
              aria-disabled="true"
              title={`${label} (เร็วๆ นี้)`}
              className="flex min-h-[44px] min-w-[56px] cursor-not-allowed flex-col items-center justify-center gap-1 rounded-xl text-[0.625rem] font-medium text-muted/40"
            >
              <Icon size={22} />
              {label}
            </span>
          );
        }
        return (
          <Link
            key={key}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl text-[0.625rem] font-medium ${
              active ? 'text-brand' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon size={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
