'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  HelpCircleIcon,
  MapPinIcon,
  RefreshIcon,
} from '@/components/icons';
import {
  groupOutcomeLabel,
  memberStateLabel,
  workOrderKindLabel,
  workOrderStatusLabel,
  type GroupOutcome,
  type MemberState,
} from '@/presentation/thai-labels';

interface SyncFieldGroupMember {
  memberKey: string;
  label: string;
}
interface SyncFieldGroup {
  key: string;
  label: string;
  help: string | null;
  order: number;
  required: boolean;
  reasonPolicy: string;
  photoPolicy: string;
  members: SyncFieldGroupMember[];
}
interface SyncWorkOrder {
  id: string;
  code: string;
  kind: string;
  status: string;
  dueAt: string | null;
  scheduledFor: string | null;
  asset: { code: string; name: string; latitude: number; longitude: number };
  groups: SyncFieldGroup[];
}
interface SyncBootstrap {
  generatedAt: string;
  workOrders: SyncWorkOrder[];
}
interface ApiErrorBody {
  message?: string;
  error?: string;
}

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: 'bg-unknown-tint text-unknown-ink',
  ASSIGNED: 'bg-watch-tint text-watch-ink',
  IN_PROGRESS: 'bg-watch-tint text-watch-ink',
  SUBMITTED: 'bg-watch-tint text-watch-ink',
  REOPENED: 'bg-down-tint text-down-ink',
};

const OUTCOMES: readonly {
  value: GroupOutcome;
  Icon: (p: { size?: number }) => React.ReactElement;
}[] = [
  { value: 'NORMAL', Icon: CheckCircleIcon },
  { value: 'PROBLEM', Icon: AlertTriangleIcon },
  { value: 'UNTESTABLE', Icon: HelpCircleIcon },
];

const MEMBER_STATES: readonly MemberState[] = ['OK', 'PROBLEM', 'UNTESTED'];

interface GroupAnswer {
  outcome?: GroupOutcome;
  members: Record<string, MemberState>;
  note: string;
  reason: string;
}

function emptyAnswer(): GroupAnswer {
  return { members: {}, note: '', reason: '' };
}

function formatThaiDate(value: string | null): string {
  if (!value) return 'ไม่กำหนด';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'วันที่ไม่ถูกต้อง';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    throw new Error(
      errorBody?.message ?? errorBody?.error ?? `คำขอไม่สำเร็จ (${response.status})`,
    );
  }
  return body as T;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  return readJson<T>(await fetch(url, init));
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getDeviceId(): string {
  const key = 'sos-maintenance-device-id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error('อ่านตำแหน่งไม่สำเร็จ — อนุญาตตำแหน่งแล้วลองใหม่')),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

async function loadBootstrap(): Promise<SyncBootstrap> {
  return requestJson<SyncBootstrap>('/api/sync/bootstrap', { cache: 'no-store' });
}

function EmptyWorkOrders() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-unknown-tint text-unknown-ink">
        <HelpCircleIcon size={22} />
      </span>
      <p className="font-semibold text-ink">ยังไม่มีใบงานที่เปิดอยู่</p>
      <p className="max-w-[34ch] text-xs leading-relaxed text-muted">
        ระบบแสดงข้อมูลจริงจากใบงานที่มอบหมายหรือกำลังดำเนินการ เมื่อมีใบงานแล้วจะปรากฏที่นี่
      </p>
    </div>
  );
}

function groupComplete(group: SyncFieldGroup, answer: GroupAnswer): boolean {
  if (!answer.outcome) return !group.required;
  if (answer.outcome === 'PROBLEM') {
    const hasProblem = Object.values(answer.members).some((s) => s === 'PROBLEM');
    return hasProblem && answer.note.trim().length > 0;
  }
  if (answer.outcome === 'UNTESTABLE') return answer.reason.trim().length > 0;
  return true; // NORMAL
}

function InspectionForm({
  workOrder,
  online,
  onChanged,
}: {
  workOrder: SyncWorkOrder;
  online: boolean;
  onChanged: () => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<string, GroupAnswer>>({});
  const [generalNote, setGeneralNote] = useState('');
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = useMemo(
    () => workOrder.groups.filter((g) => !groupComplete(g, answers[g.key] ?? emptyAnswer())).length,
    [answers, workOrder.groups],
  );

  function update(groupKey: string, patch: Partial<GroupAnswer>) {
    setAnswers((cur) => ({ ...cur, [groupKey]: { ...emptyAnswer(), ...cur[groupKey], ...patch } }));
  }

  function setMember(groupKey: string, memberKey: string, state: MemberState) {
    setAnswers((cur) => {
      const a = { ...emptyAnswer(), ...cur[groupKey] };
      a.members = { ...a.members, [memberKey]: state };
      return { ...cur, [groupKey]: a };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || remaining > 0 || working) return;
    setWorking(true);
    setError(null);
    const currentMutationId = mutationId ?? crypto.randomUUID();
    if (!mutationId) setMutationId(currentMutationId);

    try {
      const gps = await getCurrentPosition();
      const groups = workOrder.groups.map((g) => {
        const a = answers[g.key] ?? emptyAnswer();
        if (a.outcome === 'PROBLEM') {
          return {
            groupKey: g.key,
            outcome: 'PROBLEM' as const,
            members: g.members.map((m) => ({ memberKey: m.memberKey, state: a.members[m.memberKey] ?? 'UNTESTED' })),
            note: a.note,
          };
        }
        if (a.outcome === 'UNTESTABLE') {
          return { groupKey: g.key, outcome: 'UNTESTABLE' as const, reason: a.reason };
        }
        return { groupKey: g.key, outcome: 'NORMAL' as const };
      });
      const payload = {
        workOrderId: workOrder.id,
        groups,
        ...(generalNote.trim() ? { generalNote: generalNote.trim() } : {}),
        gps,
      };
      const envelope = {
        mutationId: currentMutationId,
        deviceId: getDeviceId(),
        entity: 'checklist_response',
        action: 'create',
        baseVersion: null,
        clientOccurredAt: new Date().toISOString(),
        payloadChecksum: await sha256(JSON.stringify(payload)),
        payload,
      };

      await requestJson('/api/inspections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      await requestJson(`/api/work-orders/${encodeURIComponent(workOrder.code)}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'SUBMITTED' }),
      });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ส่งผลตรวจไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 border-t border-border pt-4">
      <div className="flex items-start gap-2 text-xs text-muted">
        <MapPinIcon size={16} />
        <p>เมื่อส่งผลตรวจ ระบบจะบันทึกตำแหน่งที่จุดตรวจโดยอัตโนมัติ</p>
      </div>

      <div className="mt-4 space-y-4">
        {workOrder.groups.map((group) => {
          const answer = answers[group.key] ?? emptyAnswer();
          return (
            <fieldset key={group.key} className="rounded-xl border border-border p-3">
              <legend className="px-1 text-sm font-semibold text-ink">{group.label}</legend>
              {group.help ? (
                <p id={`help-${group.key}`} className="px-1 text-xs text-muted">{group.help}</p>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={group.label} aria-describedby={group.help ? `help-${group.key}` : undefined}>
                {OUTCOMES.map(({ value, Icon }) => {
                  const selected = answer.outcome === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update(group.key, { outcome: value })}
                      className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium ${selected ? 'border-brand bg-brand/10 text-brand' : 'border-border-strong bg-bg text-ink'}`}
                    >
                      <Icon size={18} />
                      {groupOutcomeLabel(value)}
                    </button>
                  );
                })}
              </div>

              {answer.outcome === 'PROBLEM' ? (
                <div className="mt-3 space-y-3 border-t border-border pt-3" aria-expanded="true">
                  {group.members.map((member) => (
                    <div key={member.memberKey}>
                      <p className="text-xs text-ink">{member.label}</p>
                      <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label={member.label}>
                        {MEMBER_STATES.map((state) => {
                          const selected = answer.members[member.memberKey] === state;
                          return (
                            <button
                              key={state}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setMember(group.key, member.memberKey, state)}
                              className={`min-h-11 rounded-lg border px-2 text-xs font-medium ${selected ? 'border-brand bg-brand/10 text-brand' : 'border-border-strong bg-bg text-ink'}`}
                            >
                              {memberStateLabel(state)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <label className="block text-xs text-ink" htmlFor={`note-${group.key}`}>
                    อาการที่พบ (จำเป็น)
                    <textarea
                      id={`note-${group.key}`}
                      value={answer.note}
                      onChange={(e) => update(group.key, { note: e.target.value })}
                      required
                      rows={2}
                      className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  {!groupComplete(group, answer) ? (
                    <p role="alert" className="text-xs text-down-ink">เลือกอย่างน้อยหนึ่งรายการที่มีปัญหา และระบุอาการ</p>
                  ) : null}
                </div>
              ) : null}

              {answer.outcome === 'UNTESTABLE' ? (
                <div className="mt-3 border-t border-border pt-3">
                  <label className="block text-xs text-ink" htmlFor={`reason-${group.key}`}>
                    เหตุผลที่ตรวจไม่ได้ (จำเป็น)
                    <textarea
                      id={`reason-${group.key}`}
                      value={answer.reason}
                      onChange={(e) => update(group.key, { reason: e.target.value })}
                      required
                      rows={2}
                      className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
                    />
                  </label>
                  {!groupComplete(group, answer) ? (
                    <p role="alert" className="text-xs text-down-ink">กรุณาระบุเหตุผล</p>
                  ) : null}
                </div>
              ) : null}
            </fieldset>
          );
        })}

        <label className="block text-xs text-ink" htmlFor={`general-${workOrder.code}`}>
          หมายเหตุเพิ่มเติม (ถ้ามี)
          <textarea
            id={`general-${workOrder.code}`}
            value={generalNote}
            onChange={(e) => setGeneralNote(e.target.value)}
            rows={2}
            className="mt-1 min-h-11 w-full rounded-lg border border-border-strong bg-bg px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>

      {error ? <p role="alert" className="mt-3 rounded-xl bg-down-tint px-3 py-3 text-xs text-down-ink">{error}</p> : null}
      {!online ? <p className="mt-3 text-xs text-watch-ink">ออฟไลน์ — เชื่อมต่ออินเทอร์เน็ตก่อนส่งผลตรวจ</p> : null}
      <button
        type="submit"
        disabled={!online || remaining > 0 || working}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircleIcon size={18} />
        {working ? 'กำลังบันทึกผลตรวจ…' : remaining > 0 ? `ตอบให้ครบอีก ${remaining} กลุ่ม` : 'ส่งผลตรวจ'}
      </button>
    </form>
  );
}

function WorkOrderCard({
  workOrder,
  online,
  onChanged,
}: {
  workOrder: SyncWorkOrder;
  online: boolean;
  onChanged: () => Promise<void>;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusClass = STATUS_STYLE[workOrder.status] ?? 'bg-unknown-tint text-unknown-ink';
  const canStart = ['ASSIGNED', 'REOPENED'].includes(workOrder.status);
  const hasGroups = workOrder.groups.length > 0;

  async function start() {
    if (!online || working) return;
    setWorking(true);
    setError(null);
    try {
      await requestJson(`/api/work-orders/${encodeURIComponent(workOrder.code)}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'IN_PROGRESS' }),
      });
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เริ่มงานไม่สำเร็จ');
    } finally {
      setWorking(false);
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm" aria-labelledby={`work-order-${workOrder.code}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{workOrderKindLabel(workOrder.kind)}</p>
          <h3 id={`work-order-${workOrder.code}`} className="mt-1 font-semibold text-ink">{workOrder.code}</h3>
          <p className="mt-1 text-sm text-brand">{workOrder.asset.code} · {workOrder.asset.name}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
          <ClockIcon size={14} />
          {workOrderStatusLabel(workOrder.status)}
        </span>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted">
        <p><span className="block text-[0.6875rem] text-muted">กำหนดตรวจ</span><span className="mt-1 block text-ink">{formatThaiDate(workOrder.scheduledFor ?? workOrder.dueAt)}</span></p>
        <p><span className="block text-[0.6875rem] text-muted">กลุ่มตรวจ</span><span className="mt-1 block text-ink">{workOrder.groups.length} กลุ่ม</span></p>
      </div>

      {!hasGroups ? (
        <p role="alert" className="mt-4 rounded-xl bg-watch-tint px-3 py-3 text-xs text-watch-ink">
          ใบงานนี้ผูกกับเวอร์ชันเดิมที่ยังไม่มีกลุ่มภาคสนาม กรุณาให้ผู้วางแผนออกใบงานใหม่ภายใต้เวอร์ชันปัจจุบัน
        </p>
      ) : (
        <>
          {canStart ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={!online || working}
              className="mt-4 min-h-11 w-full rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working ? 'กำลังเริ่มงาน…' : 'เริ่มงาน'}
            </button>
          ) : null}
          {workOrder.status === 'PUBLISHED' ? <p className="mt-4 text-xs text-muted">รอผู้วางแผนมอบหมายก่อนเริ่มงาน</p> : null}
          {workOrder.status === 'SUBMITTED' ? <p className="mt-4 text-xs text-muted">ส่งผลตรวจแล้ว รอผู้วางแผนตรวจรับ</p> : null}
          {workOrder.status === 'IN_PROGRESS' ? <InspectionForm workOrder={workOrder} online={online} onChanged={onChanged} /> : null}
        </>
      )}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-down-tint px-3 py-3 text-xs text-down-ink">{error}</p> : null}
    </article>
  );
}

export function TodayWorkspace() {
  const [bootstrap, setBootstrap] = useState<SyncBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBootstrap(await loadBootstrap());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดใบงานไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [refresh]);

  return (
    <section id="today-workspace" className="mt-6" aria-labelledby="today-workspace-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="today-workspace-title" className="px-1 text-sm font-semibold text-ink">ใบงานภาคสนาม</h2>
          <p className="mt-1 px-1 text-xs text-muted">
            {bootstrap ? `ข้อมูลล่าสุด ${formatThaiDate(bootstrap.generatedAt)} · ${bootstrap.workOrders.length} ใบงาน` : 'กำลังโหลดข้อมูลจากระบบ'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading || !online}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 text-xs font-semibold text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshIcon size={16} />
          โหลดล่าสุด
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {loading && !bootstrap ? <p role="status" className="rounded-2xl border border-border bg-surface px-5 py-10 text-center text-sm text-muted">กำลังโหลดใบงาน…</p> : null}
        {error ? (
          <div className="rounded-2xl border border-border bg-surface px-5 py-10 text-center">
            <p role="alert" className="text-sm text-down-ink">{error}</p>
            <button type="button" onClick={() => void refresh()} className="mt-4 min-h-10 rounded-xl bg-brand px-4 text-xs font-semibold text-white">ลองโหลดใหม่</button>
          </div>
        ) : null}
        {!loading && !error && bootstrap?.workOrders.length === 0 ? <EmptyWorkOrders /> : null}
        {bootstrap?.workOrders.map((workOrder) => (
          <WorkOrderCard key={workOrder.id} workOrder={workOrder} online={online} onChanged={refresh} />
        ))}
      </div>
    </section>
  );
}
