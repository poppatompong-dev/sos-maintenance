'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  HelpCircleIcon,
  MapPinIcon,
  RefreshIcon,
} from '@/components/icons';

type ResponseResult = 'PASS' | 'FAIL' | 'NA' | 'UNKNOWN';

interface SyncChecklistItem {
  code: string;
  label: string;
  kind: string;
  criticality: 'CRITICAL' | 'NON_CRITICAL';
  criticalFunctionKey: string | null;
  requiresPhoto: boolean;
}

interface SyncWorkOrder {
  id: string;
  code: string;
  kind: string;
  status: string;
  dueAt: string | null;
  scheduledFor: string | null;
  asset: { code: string; name: string; latitude: number; longitude: number };
  checklist: SyncChecklistItem[];
}

interface SyncBootstrap {
  generatedAt: string;
  workOrders: SyncWorkOrder[];
}

interface ApiErrorBody {
  message?: string;
  error?: string;
}

const KIND_LABEL: Record<string, string> = {
  INITIAL_SURVEY: 'สำรวจตั้งต้น',
  WEEKLY_CENTER: 'ตรวจรายสัปดาห์',
  MONTHLY_FIELD: 'ตรวจรายเดือน',
  SEMIANNUAL_DEEP: 'ตรวจราย 6 เดือน',
  CORRECTIVE: 'ซ่อมแก้ไข',
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  PUBLISHED: { label: 'รอมอบหมาย', className: 'bg-unknown-tint text-unknown-ink' },
  ASSIGNED: { label: 'มอบหมายแล้ว', className: 'bg-watch-tint text-watch-ink' },
  IN_PROGRESS: { label: 'กำลังดำเนินการ', className: 'bg-watch-tint text-watch-ink' },
  SUBMITTED: { label: 'รอตรวจรับ', className: 'bg-watch-tint text-watch-ink' },
  REOPENED: { label: 'เปิดแก้ไข', className: 'bg-down-tint text-down-ink' },
};

const RESULT_OPTIONS: readonly { value: ResponseResult; label: string }[] = [
  { value: 'PASS', label: 'ผ่าน' },
  { value: 'FAIL', label: 'ไม่ผ่าน' },
  { value: 'NA', label: 'ไม่เกี่ยวข้อง' },
  { value: 'UNKNOWN', label: 'ยังไม่ทราบ' },
];

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
    // Private browsing may deny storage; a per-submit device id is still safer
    // than blocking a connected field inspection entirely.
    return crypto.randomUUID();
  }
}

function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง GPS'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error('อ่านตำแหน่ง GPS ไม่สำเร็จ — อนุญาตตำแหน่งแล้วลองใหม่')),
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
        ระบบแสดงข้อมูลจริงจากใบงานที่มอบหมายหรือกำลังดำเนินการ
        เมื่อมีใบงานแล้วจะปรากฏที่นี่เพื่อทำงานภาคสนาม
      </p>
    </div>
  );
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
  const [responses, setResponses] = useState<Record<string, ResponseResult>>({});
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unanswered = useMemo(
    () => workOrder.checklist.filter((item) => !responses[item.code]).length,
    [responses, workOrder.checklist],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || unanswered > 0 || working) return;

    setWorking(true);
    setError(null);
    const currentMutationId = mutationId ?? crypto.randomUUID();
    if (!mutationId) setMutationId(currentMutationId);

    try {
      const gps = await getCurrentPosition();
      const payload = {
        workOrderId: workOrder.id,
        responses: workOrder.checklist.map((item) => ({
          itemCode: item.code,
          label: item.label,
          result: responses[item.code],
          criticality: item.criticality,
          ...(item.criticalFunctionKey
            ? { criticalFunctionKey: item.criticalFunctionKey }
            : {}),
        })),
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

      // Evidence is idempotent by mutationId; workflow state is advanced only
      // after the evidence write succeeds. Retrying reuses the same mutation.
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
        <p>เมื่อส่งผลตรวจ ระบบจะอ่าน GPS และบันทึกธงตรวจสอบหากห่างจากจุดเกินเกณฑ์</p>
      </div>
      <fieldset className="mt-4 space-y-3">
        <legend className="text-sm font-semibold text-ink">ผลตรวจเช็คลิสต์</legend>
        {workOrder.checklist.length === 0 ? (
          <p className="rounded-xl bg-down-tint px-3 py-3 text-xs text-down-ink">
            ใบงานนี้ยังไม่มีรายการเช็คลิสต์ จึงส่งผลตรวจไม่ได้
          </p>
        ) : (
          workOrder.checklist.map((item) => (
            <label key={item.code} className="block text-xs text-ink" htmlFor={`${workOrder.code}-${item.code}`}>
              <span className="mb-1.5 flex items-center justify-between gap-3">
                <span>
                  {item.label}
                  {item.criticality === 'CRITICAL' ? (
                    <span className="ml-1 text-down-ink" aria-label="รายการสำคัญ">*</span>
                  ) : null}
                </span>
                <span className="text-muted">{item.kind}</span>
              </span>
              <select
                id={`${workOrder.code}-${item.code}`}
                value={responses[item.code] ?? ''}
                onChange={(event) =>
                  setResponses((current) => ({
                    ...current,
                    [item.code]: event.target.value as ResponseResult,
                  }))
                }
                className="min-h-11 w-full rounded-xl border border-border-strong bg-bg px-3 text-sm text-ink"
                required
              >
                <option value="" disabled>เลือกผลตรวจ</option>
                {RESULT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ))
        )}
      </fieldset>
      {error ? <p role="alert" className="mt-3 rounded-xl bg-down-tint px-3 py-3 text-xs text-down-ink">{error}</p> : null}
      {!online ? <p className="mt-3 text-xs text-watch-ink">ออฟไลน์ — เชื่อมต่ออินเทอร์เน็ตก่อนส่งผลตรวจ</p> : null}
      <button
        type="submit"
        disabled={!online || unanswered > 0 || workOrder.checklist.length === 0 || working}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircleIcon size={18} />
        {working ? 'กำลังบันทึกผลตรวจ…' : unanswered > 0 ? `เลือกผลตรวจอีก ${unanswered} รายการ` : 'ส่งผลตรวจ'}
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
  const status = STATUS_META[workOrder.status] ?? {
    label: workOrder.status,
    className: 'bg-unknown-tint text-unknown-ink',
  };
  const canStart = ['ASSIGNED', 'REOPENED'].includes(workOrder.status);

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
          <p className="text-xs text-muted">{KIND_LABEL[workOrder.kind] ?? workOrder.kind}</p>
          <h3 id={`work-order-${workOrder.code}`} className="mt-1 font-semibold text-ink">{workOrder.code}</h3>
          <p className="mt-1 text-sm text-brand">{workOrder.asset.code} · {workOrder.asset.name}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
          <ClockIcon size={14} />
          {status.label}
        </span>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted">
        <p><span className="block text-[0.6875rem] text-muted">กำหนดตรวจ</span><span className="mt-1 block text-ink">{formatThaiDate(workOrder.scheduledFor ?? workOrder.dueAt)}</span></p>
        <p><span className="block text-[0.6875rem] text-muted">เช็คลิสต์</span><span className="mt-1 block text-ink">{workOrder.checklist.length} รายการ</span></p>
      </div>

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
