'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { scheduleBatchStatusLabel, workOrderKindLabel } from '@/presentation/thai-labels';
import { formatThaiDate } from '@/domain/shared/thai-date';

export interface ScheduleBatchRow {
  id: string;
  name: string;
  status: string;
  planKind: string;
  planName: string;
  workOrderCount: number;
  createdAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
}
export interface PlanOption {
  id: string;
  name: string;
  kind: string;
  assetTypeKey: string;
}
interface ApiErrorBody {
  message?: string;
  error?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new Error(errorBody?.message ?? errorBody?.error ?? `คำขอไม่สำเร็จ (${response.status})`);
  }
  return body as T;
}

const BATCH_NEXT: Record<string, { to: string; label: string }[]> = {
  DRAFT: [{ to: 'APPROVED', label: 'อนุมัติ' }],
  APPROVED: [{ to: 'PUBLISHED', label: 'เผยแพร่' }],
  PUBLISHED: [],
};

function BatchRow({ batch }: { batch: ScheduleBatchRow }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actions = BATCH_NEXT[batch.status] ?? [];

  async function act(to: string) {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/schedule-batches/${encodeURIComponent(batch.id)}/transition`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ to }),
        }),
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  return (
    <tr className="border-b border-border/70 last:border-0 hover:bg-panel">
      <th scope="row" className="py-3 pr-3 pl-5 text-left font-semibold text-ink">{batch.name}</th>
      <td className="px-3 py-3 text-muted">{workOrderKindLabel(batch.planKind)} · {batch.planName}</td>
      <td className="px-3 py-3 tabular-nums text-muted">{batch.workOrderCount}</td>
      <td className="px-3 py-3">
        <span className="inline-flex w-max items-center rounded-full bg-unknown-tint px-2.5 py-1 text-xs font-semibold text-unknown-ink">
          {scheduleBatchStatusLabel(batch.status)}
        </span>
      </td>
      <td className="px-3 py-3 text-muted tabular-nums">{formatThaiDate(new Date(batch.createdAt))}</td>
      <td className="py-3 pr-5 pl-3">
        {actions.length === 0 ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((a) => (
              <button
                key={a.to}
                type="button"
                disabled={working}
                onClick={() => void act(a.to)}
                className="min-h-9 rounded-lg bg-brand px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working ? 'กำลังบันทึก…' : a.label}
              </button>
            ))}
          </div>
        )}
        {error ? <p role="alert" className="mt-1.5 text-xs text-down-ink">{error}</p> : null}
      </td>
    </tr>
  );
}

function CreateBatchForm({ plans, onCreated }: { plans: PlanOption[]; onCreated: () => void }) {
  const router = useRouter();
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [name, setName] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working || !planId || !name.trim()) return;
    setWorking(true);
    setError(null);
    try {
      await readJson(
        await fetch('/api/schedule-batches', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            planId,
            name: name.trim(),
            ...(scheduledFor ? { scheduledFor: new Date(scheduledFor).toISOString() } : {}),
            ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
          }),
        }),
      );
      setName('');
      setScheduledFor('');
      setDueAt('');
      onCreated();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'สร้างชุดงานไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  if (plans.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong bg-panel px-4 py-4 text-xs text-muted">
        ยังไม่มีแผนบำรุงรักษาที่ใช้งานอยู่ — สร้างชุดงานไม่ได้จนกว่าจะมีแผน
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-panel p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-ink sm:col-span-2" htmlFor="batch-plan">
          แผนบำรุงรักษา
          <select
            id="batch-plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
          >
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {workOrderKindLabel(p.kind)} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-ink sm:col-span-2" htmlFor="batch-name">
          ชื่อรอบงาน
          <input
            id="batch-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น รอบตรวจเดือนสิงหาคม 2569"
            className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block text-xs text-ink" htmlFor="batch-scheduled">
          กำหนดตรวจ (ถ้ามี)
          <input
            id="batch-scheduled"
            type="date"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="block text-xs text-ink" htmlFor="batch-due">
          กำหนดเสร็จ (ถ้ามี)
          <input
            id="batch-due"
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>
      {error ? <p role="alert" className="mt-3 rounded-lg bg-down-tint px-3 py-2 text-xs text-down-ink">{error}</p> : null}
      <button
        type="submit"
        disabled={working || !name.trim()}
        className="mt-3 min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {working ? 'กำลังสร้าง…' : 'สร้างชุดงานร่าง'}
      </button>
    </form>
  );
}

export function ScheduleBatchPanel({ batches, plans }: { batches: ScheduleBatchRow[]; plans: PlanOption[] }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-xs text-muted">
          ชุดงานร่างเกิดสถานะ ร่าง → อนุมัติแล้ว → เผยแพร่แล้ว เท่านั้น — เผยแพร่แล้วปล่อยใบงานให้ช่างเห็น
        </p>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="min-h-10 shrink-0 rounded-xl border border-border-strong bg-surface px-3.5 text-xs font-semibold text-brand hover:bg-panel"
        >
          {showForm ? 'ซ่อนฟอร์ม' : '+ สร้างชุดงานใหม่'}
        </button>
      </div>
      {showForm ? (
        <div className="px-5 pb-4">
          <CreateBatchForm plans={plans} onCreated={() => setShowForm(false)} />
        </div>
      ) : null}

      {batches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <p className="font-semibold text-ink">ยังไม่มีชุดงาน</p>
          <p className="max-w-[40ch] text-xs leading-relaxed text-muted">
            สร้างชุดงานจากแผนบำรุงรักษาเพื่อออกใบงานให้เสาที่เกี่ยวข้องทั้งหมด
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">รายการชุดงานทั้งหมด</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">ชื่อรอบงาน</th>
                <th scope="col" className="px-3 py-2.5 font-medium">แผน</th>
                <th scope="col" className="px-3 py-2.5 font-medium">จำนวนใบงาน</th>
                <th scope="col" className="px-3 py-2.5 font-medium">สถานะ</th>
                <th scope="col" className="px-3 py-2.5 font-medium">สร้างเมื่อ</th>
                <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <BatchRow key={b.id} batch={b} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
