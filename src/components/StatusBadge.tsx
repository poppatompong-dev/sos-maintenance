import type { ReadinessStatus } from '@/domain/readiness';
import { STATUS_META } from '@/lib/readiness-view';

/** Status conveyed as icon + Thai text (never colour alone). */
export function StatusBadge({
  status,
  size = 'md',
}: {
  status: ReadinessStatus;
  size?: 'sm' | 'md';
}) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  return (
    <span
      className={`inline-flex w-max items-center gap-1.5 rounded-full font-semibold ${meta.chip} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-[0.8125rem]'
      }`}
    >
      <Icon size={size === 'sm' ? 13 : 15} />
      {meta.label}
    </span>
  );
}
