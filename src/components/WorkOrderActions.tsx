'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  faultSeverityLabel,
  faultStatusLabel,
  workOrderStatusLabel,
} from '@/presentation/thai-labels';
import { formatThaiDate } from '@/domain/shared/thai-date';

/**
 * Curated Planner-facing subset of the work-order state machine
 * (`src/domain/work/state-machine.ts`). Technician-only edges (→IN_PROGRESS,
 * →SUBMITTED) are deliberately omitted here — a Planner cannot reach them, and
 * offering the button would be dishonest UI. The server remains the sole
 * authority: every click still goes through `canTransition` via the API.
 */
export const PLANNER_NEXT: Record<
  string,
  { to: string; label: string; tone: 'primary' | 'default' | 'danger' }[]
> = {
  DRAFT: [
    { to: 'PUBLISHED', label: 'เผยแพร่', tone: 'primary' },
    { to: 'ASSIGNED', label: 'มอบหมาย', tone: 'primary' },
    { to: 'CANCELLED', label: 'ยกเลิก', tone: 'danger' },
  ],
  PUBLISHED: [
    { to: 'ASSIGNED', label: 'มอบหมาย', tone: 'primary' },
    { to: 'CANCELLED', label: 'ยกเลิก', tone: 'danger' },
  ],
  ASSIGNED: [{ to: 'CANCELLED', label: 'ยกเลิก', tone: 'danger' }],
  IN_PROGRESS: [{ to: 'CANCELLED', label: 'ยกเลิก', tone: 'danger' }],
  SUBMITTED: [
    { to: 'CLOSED', label: 'ตรวจรับ', tone: 'primary' },
    { to: 'REJECTED', label: 'ตีกลับ', tone: 'danger' },
  ],
  REJECTED: [{ to: 'CANCELLED', label: 'ยกเลิก', tone: 'danger' }],
  CLOSED: [{ to: 'REOPENED', label: 'เปิดใหม่', tone: 'default' }],
  REOPENED: [{ to: 'CANCELLED', label: 'ยกเลิก', tone: 'danger' }],
  CANCELLED: [],
};

const TONE_CLASS: Record<string, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong',
  default: 'border border-border-strong bg-surface text-ink hover:bg-panel',
  danger: 'border border-down-tint bg-down-tint/40 text-down-ink hover:bg-down-tint',
};

interface TechnicianOption {
  id: string;
  displayName: string;
}
interface RepairEvidence {
  cause: string;
  fixDescription: string;
  changedParts: string | null;
  retestPassed: boolean | null;
  retestNote: string | null;
  createdAt: string;
}
interface WorkOrderDetail {
  fault: {
    code: string;
    severity: string;
    status: string;
    symptom: string;
    latestRepair: RepairEvidence | null;
  } | null;
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

/** Inline action panel for one work order — rendered by the caller when expanded. */
export function WorkOrderActionPanel({
  code,
  status,
  kind,
  onClose,
}: {
  code: string;
  status: string;
  kind: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkOrderDetail | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianOption[] | null>(null);
  const [assigneeId, setAssigneeId] = useState('');

  const actions = PLANNER_NEXT[status] ?? [];
  const showRepairEvidence = kind === 'CORRECTIVE' && status === 'SUBMITTED';
  const loadingDetail = showRepairEvidence && detail === null && error === null;
  const showAssigneePicker = actions.some((a) => a.to === 'ASSIGNED');

  useEffect(() => {
    if (!showRepairEvidence) return;
    let cancelled = false;
    fetch(`/api/work-orders/${encodeURIComponent(code)}`, { cache: 'no-store' })
      .then((res) => readJson<WorkOrderDetail>(res))
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'โหลดหลักฐานงานซ่อมไม่สำเร็จ');
      });
    return () => {
      cancelled = true;
    };
  }, [code, showRepairEvidence]);

  useEffect(() => {
    if (!showAssigneePicker) return;
    let cancelled = false;
    fetch('/api/technicians', { cache: 'no-store' })
      .then((res) => readJson<{ technicians: TechnicianOption[] }>(res))
      .then((d) => {
        if (cancelled) return;
        setTechnicians(d.technicians);
        if (d.technicians.length === 1) setAssigneeId(d.technicians[0].id);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'โหลดรายชื่อช่างไม่สำเร็จ');
      });
    return () => {
      cancelled = true;
    };
  }, [showAssigneePicker]);

  async function act(to: string) {
    if (working) return;
    if (to === 'ASSIGNED' && !assigneeId) {
      setError('กรุณาเลือกช่างที่จะมอบหมายงานก่อน');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await readJson(
        await fetch(`/api/work-orders/${encodeURIComponent(code)}/transition`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            to,
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(to === 'ASSIGNED' ? { assigneeUserId: assigneeId } : {}),
          }),
        }),
      );
      router.refresh();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      {showRepairEvidence ? (
        <div className="mb-3 rounded-lg border border-border bg-surface p-3">
          {loadingDetail ? (
            <p className="text-xs text-muted">กำลังโหลดหลักฐานงานซ่อม…</p>
          ) : detail?.fault?.latestRepair ? (
            <dl className="space-y-1.5 text-xs">
              <p className="font-semibold text-ink">
                {detail.fault.code} · {faultSeverityLabel(detail.fault.severity)} ·{' '}
                {faultStatusLabel(detail.fault.status)}
              </p>
              <div>
                <dt className="text-muted">สาเหตุ</dt>
                <dd className="text-ink">{detail.fault.latestRepair.cause}</dd>
              </div>
              <div>
                <dt className="text-muted">วิธีแก้</dt>
                <dd className="text-ink">{detail.fault.latestRepair.fixDescription}</dd>
              </div>
              {detail.fault.latestRepair.changedParts ? (
                <div>
                  <dt className="text-muted">ชิ้นส่วนที่เปลี่ยน</dt>
                  <dd className="text-ink">{detail.fault.latestRepair.changedParts}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted">ผล retest</dt>
                <dd className={detail.fault.latestRepair.retestPassed ? 'text-ready-ink' : 'text-down-ink'}>
                  {detail.fault.latestRepair.retestPassed ? 'ผ่าน' : 'ไม่ผ่าน'}
                  {detail.fault.latestRepair.retestNote ? ` — ${detail.fault.latestRepair.retestNote}` : ''}
                </dd>
              </div>
              <p className="text-muted">
                บันทึกเมื่อ {formatThaiDate(new Date(detail.fault.latestRepair.createdAt))}
              </p>
            </dl>
          ) : (
            <p className="text-xs text-muted">ยังไม่มีบันทึกงานซ่อมสำหรับใบงานนี้</p>
          )}
        </div>
      ) : null}

      {showAssigneePicker ? (
        <label className="mb-3 block text-xs text-ink" htmlFor={`assignee-${code}`}>
          มอบหมายให้ช่าง
          <select
            id={`assignee-${code}`}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="mt-1 min-h-11 w-full max-w-md rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
          >
            <option value="">
              {technicians === null ? 'กำลังโหลดรายชื่อช่าง…' : 'เลือกช่าง'}
            </option>
            {(technicians ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.displayName}</option>
            ))}
          </select>
          {technicians?.length === 0 ? (
            <span className="mt-1 block text-xs text-down-ink">
              ยังไม่มีช่างในระบบ — มอบหมายงานไม่ได้จนกว่าจะมีรายชื่อช่าง
            </span>
          ) : null}
        </label>
      ) : null}

      <label className="block text-xs text-ink" htmlFor={`note-${code}`}>
        หมายเหตุ (ถ้ามี)
        <textarea
          id={`note-${code}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 min-h-11 w-full max-w-md rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
        />
      </label>

      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-down-tint px-2.5 py-2 text-xs text-down-ink">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {actions.length === 0 ? (
          <p className="text-xs text-muted">ไม่มีการดำเนินการที่ทำได้จากสถานะนี้</p>
        ) : (
          actions.map((a) => (
            <button
              key={a.to}
              type="button"
              disabled={working || (a.to === 'ASSIGNED' && !assigneeId)}
              onClick={() => void act(a.to)}
              className={`min-h-9 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${TONE_CLASS[a.tone]}`}
            >
              {working ? 'กำลังบันทึก…' : `${a.label} → ${workOrderStatusLabel(a.to)}`}
            </button>
          ))
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-9 rounded-lg px-3 text-xs font-medium text-muted hover:text-ink"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
