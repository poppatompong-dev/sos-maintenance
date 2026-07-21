import type { ReadinessRollup } from '@/domain/metrics';
import { STATUS_META, STATUS_ORDER } from '@/lib/readiness-view';

/**
 * Continuous status rail (doc 02/09): one panel, a proportional bar + four
 * readouts — not a wall of KPI cards. Numbers are tabular for steady alignment.
 */
export function StatusRail({ rollup }: { rollup: ReadinessRollup }) {
  const { counts, percentages, total } = rollup;
  const summary = STATUS_ORDER.map(
    (s) => `${STATUS_META[s].label} ${counts[s]}`,
  ).join(', ');

  return (
    <section
      aria-label="สรุปสถานะความพร้อม"
      className="overflow-hidden rounded-card border border-border bg-surface"
    >
      <div
        className="flex h-1.5 w-full bg-border"
        role="img"
        aria-label={`สัดส่วนสถานะจากทั้งหมด ${total} จุด: ${summary}`}
      >
        {STATUS_ORDER.map((s) =>
          percentages[s] > 0 ? (
            <div
              key={s}
              className={STATUS_META[s].dot}
              style={{ width: `${percentages[s]}%` }}
            />
          ) : null,
        )}
      </div>

      <div className="grid grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.Icon;
          return (
            <div key={s} className="flex items-center gap-3 px-5 py-4">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg ${meta.chip}`}
              >
                <Icon size={18} />
              </span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums leading-none">
                    {counts[s]}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {percentages[s]}%
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium text-muted">
                  {meta.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
