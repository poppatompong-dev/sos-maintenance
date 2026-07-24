import Link from 'next/link';
import {
  CalendarIcon,
  ChartIcon,
  ClipboardIcon,
  GridIcon,
  MapPinIcon,
} from './icons';

export type AppRailKey = 'overview' | 'work';

/** `href: null` means the destination doesn't exist yet — shown disabled, never a dead link. */
const NAV: { key: AppRailKey | 'map' | 'calendar' | 'reports'; label: string; Icon: typeof GridIcon; href: string | null }[] = [
  { key: 'overview', label: 'ภาพรวม', Icon: GridIcon, href: '/' },
  { key: 'map', label: 'แผนที่', Icon: MapPinIcon, href: null },
  { key: 'work', label: 'ใบงาน', Icon: ClipboardIcon, href: '/work-orders' },
  { key: 'calendar', label: 'ปฏิทิน', Icon: CalendarIcon, href: null },
  { key: 'reports', label: 'รายงาน', Icon: ChartIcon, href: null },
];

/**
 * Primary navigation: left rail on desktop, bottom bar on mobile (max 5 items).
 * `current` marks the real active item from the page that renders this, rather
 * than a hardcoded guess. Items with no destination yet render disabled with a
 * "เร็วๆ นี้" label — never a silent `href="#"` no-op.
 */
export function AppRail({ current }: { current: AppRailKey | null }) {
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-sidebar-active bg-sidebar px-2 text-sidebar-ink md:inset-y-0 md:right-auto md:left-0 md:h-full md:w-[76px] md:flex-col md:justify-start md:gap-1.5 md:border-t-0 md:py-5"
    >
      <span
        aria-hidden="true"
        className="hidden md:mb-5 md:grid md:size-11 md:place-items-center md:rounded-xl md:bg-sidebar-accent md:text-sm md:font-bold md:text-[#052a25]"
      >
        นว.
      </span>
      {NAV.map(({ key, label, Icon, href }) => {
        const active = key === current;
        if (!href) {
          return (
            <span
              key={key}
              aria-disabled="true"
              title={`${label} (เร็วๆ นี้)`}
              className="flex min-w-[56px] cursor-not-allowed flex-col items-center gap-1 rounded-xl py-1.5 text-sidebar-ink/40 md:size-11 md:min-w-0 md:justify-center md:py-0"
            >
              <Icon size={21} />
              <span className="text-[0.625rem] font-medium md:hidden">{label}</span>
            </span>
          );
        }
        return (
          <Link
            key={key}
            href={href}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={`flex min-w-[56px] flex-col items-center gap-1 rounded-xl py-1.5 transition-colors md:size-11 md:min-w-0 md:justify-center md:py-0 ${
              active
                ? 'text-sidebar-accent md:bg-sidebar-active'
                : 'hover:text-white'
            }`}
          >
            <Icon size={21} />
            <span className="text-[0.625rem] font-medium md:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
