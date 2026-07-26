'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatThaiDate } from '@/domain/shared/thai-date';
import { workOrderStatusLabel } from '@/presentation/thai-labels';

/**
 * Baseline approval panel (ASSET-06; UAT cases 1 and 11).
 *
 * The button appears only when the evidence actually supports approving —
 * an accepted (CLOSED) initial survey on an unapproved asset. In every other
 * case it explains, in Thai, what is missing instead of offering a button that
 * would fail. The server remains the sole authority: separation of duties and
 * the once-only rule are enforced by the domain, and a refusal is surfaced
 * here verbatim.
 */

interface Props {
  code: string;
  approved: boolean;
  approvedAt: string | null;
  approverName: string | null;
  survey: { code: string; status: string } | null;
}

export function BaselineApproval({
  code,
  approved,
  approvedAt,
  approverName,
  survey,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (approved) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-ink">อนุมัติแล้ว</p>
        <p className="text-xs text-muted">
          {approverName ? `โดย ${approverName}` : 'ไม่ทราบผู้อนุมัติ'}
          {approvedAt ? ` · ${formatThaiDate(new Date(approvedAt))}` : ''}
        </p>
      </div>
    );
  }

  // Honest refusals, mirroring the domain rule — never show a button that the
  // server is guaranteed to reject.
  if (!survey) {
    return (
      <p className="text-sm text-muted">
        ยังอนุมัติไม่ได้ — จุดติดตั้งนี้ยังไม่มีใบงานสำรวจตั้งต้น
      </p>
    );
  }
  if (survey.status !== 'CLOSED') {
    return (
      <p className="text-sm text-muted">
        ยังอนุมัติไม่ได้ — ใบงานสำรวจตั้งต้น {survey.code} อยู่ในสถานะ
        “{workOrderStatusLabel(survey.status)}” ต้องตรวจรับให้เรียบร้อยก่อน
      </p>
    );
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(code)}/baseline-approval`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message =
          body && typeof body === 'object' && 'message' in body
            ? String((body as { message?: unknown }).message)
            : 'อนุมัติไม่สำเร็จ';
        setError(message);
        return;
      }
      router.refresh();
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs text-muted">
        อ้างอิงใบงานสำรวจตั้งต้น {survey.code} ที่ตรวจรับแล้ว
      </p>
      <button
        type="button"
        onClick={approve}
        disabled={busy}
        className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60"
      >
        {busy ? 'กำลังอนุมัติ…' : 'อนุมัติผลสำรวจตั้งต้น'}
      </button>
      {error && (
        <p role="alert" className="text-xs font-medium text-down-ink">
          {error}
        </p>
      )}
    </div>
  );
}
