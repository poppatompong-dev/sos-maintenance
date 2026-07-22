import type { PoleOverviewRow } from '@/server/queries/readiness-overview';
import { StatusBadge } from './StatusBadge';
import { ArrowRightIcon } from './icons';

/**
 * Accessible pole list — the required non-map fallback (doc 02/09). A real
 * semantic table so screen readers and keyboard users get the same information
 * the map conveys visually.
 */
export function PoleTable({ poles }: { poles: PoleOverviewRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          รายการเสา SOS ทั้ง {poles.length} จุดพร้อมสถานะความพร้อม (มุมมองรายการสำรองของแผนที่)
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
              จุด
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              สถานะ
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              เหตุผล
            </th>
            <th scope="col" className="py-2.5 pr-5 pl-3">
              <span className="sr-only">การทำงาน</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {poles.map((p) => (
            <tr
              key={p.code}
              className="border-b border-border/70 last:border-0 hover:bg-panel"
            >
              <th scope="row" className="py-3 pr-3 pl-5 text-left font-normal">
                <div className="font-semibold text-ink">{p.code}</div>
                <div className="text-xs text-muted">{p.name}</div>
              </th>
              <td className="px-3 py-3 align-top">
                <StatusBadge status={p.status} size="sm" />
              </td>
              <td className="max-w-[24ch] px-3 py-3 align-top text-xs text-muted">
                {p.reason}
              </td>
              <td className="py-3 pr-5 pl-3 text-right align-top">
                <a
                  href={`/assets/${p.code}`}
                  aria-label={`เปิดรายละเอียด ${p.code} ${p.name}`}
                  className="inline-grid size-8 place-items-center rounded-lg text-muted hover:bg-border/60 hover:text-ink"
                >
                  <ArrowRightIcon size={16} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
