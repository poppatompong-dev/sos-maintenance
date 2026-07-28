'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardIcon, GridIcon } from './icons';

export function HeaderModeSwitcher() {
  const pathname = usePathname();
  const isField = pathname?.startsWith('/today');

  return (
    <div
      aria-label="สลับมุมมองการทำงาน"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-panel p-1 text-xs font-medium"
    >
      <Link
        href="/"
        aria-current={!isField ? 'page' : undefined}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
          !isField
            ? 'bg-surface font-semibold text-ink shadow-xs'
            : 'text-muted hover:text-ink'
        }`}
      >
        <GridIcon size={14} />
        <span>ศูนย์ควบคุม</span>
      </Link>
      <Link
        href="/today"
        aria-current={isField ? 'page' : undefined}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
          isField
            ? 'bg-surface font-semibold text-ink shadow-xs'
            : 'text-muted hover:text-ink'
        }`}
      >
        <ClipboardIcon size={14} />
        <span>ช่างสนาม</span>
      </Link>
    </div>
  );
}
