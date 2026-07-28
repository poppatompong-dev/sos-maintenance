import { describe, expect, it, vi } from 'vitest';
import {
  runJobTick,
  type AssetRecomputeCandidate,
  type JobTickPort,
  type PendingNotification,
} from './run-job-tick';
import type { ReadinessReason, ReadinessStatus } from '@/domain/readiness';

/**
 * In-memory port with a CAS-accurate `tryMarkNotificationSent`: it succeeds only
 * the first time an id is claimed, mirroring the conditional PENDING→SENT update.
 */
function portWith(
  pending: PendingNotification[],
  opts: {
    assets?: number;
    alreadySent?: string[];
    candidates?: AssetRecomputeCandidate[];
  } = {},
) {
  const claimed = new Set(opts.alreadySent ?? []);
  const persistedSnapshots: {
    assetId: string;
    status: ReadinessStatus;
    reasons: ReadinessReason[];
  }[] = [];

  const port: JobTickPort = {
    claimPendingNotifications: vi.fn(async (limit) => pending.slice(0, limit)),
    tryMarkNotificationSent: vi.fn(async (id) => {
      if (claimed.has(id)) return false; // lost the race / already sent
      claimed.add(id);
      return true;
    }),
    countActiveAssets: vi.fn(async () => opts.assets ?? 27),
    loadActiveAssetsForRecompute: vi.fn(async () => opts.candidates ?? []),
    persistReadinessRecompute: vi.fn(async (assetId, status, reasons) => {
      persistedSnapshots.push({ assetId, status, reasons });
    }),
  };
  return { port, claimed, persistedSnapshots };
}

const now = new Date('2026-07-22T00:00:00Z');

describe('runJobTick', () => {
  it('sends in-app notifications and defers email ones', async () => {
    const { port, claimed } = portWith([
      { id: 'n1', channel: 'IN_APP' },
      { id: 'n2', channel: 'EMAIL' },
      { id: 'n3', channel: 'IN_APP' },
    ]);
    const res = await runJobTick(port, { now });
    expect(res.notificationsSent).toBe(2);
    expect(res.notificationsDeferred).toBe(1);
    expect(res.assetsInScope).toBe(27);
    expect([...claimed].sort()).toEqual(['n1', 'n3']);
  });

  it('does NOT count a notification already claimed by another tick', async () => {
    const { port } = portWith(
      [
        { id: 'n1', channel: 'IN_APP' },
        { id: 'n2', channel: 'IN_APP' },
      ],
      { alreadySent: ['n1'] },
    );
    const res = await runJobTick(port, { now });
    // n1 lost the CAS (already sent), only n2 counts.
    expect(res.notificationsSent).toBe(1);
  });

  it('is a no-op summary when nothing is pending', async () => {
    const { port } = portWith([], { assets: 27 });
    const res = await runJobTick(port, { now });
    expect(res).toMatchObject({
      notificationsSent: 0,
      notificationsDeferred: 0,
      assetsInScope: 27,
      assetsRecomputed: 0,
      readinessFlips: 0,
    });
  });

  it('bounds the batch by the limit', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, channel: 'IN_APP' }));
    const { port } = portWith(many);
    const res = await runJobTick(port, { now, limit: 3 });
    expect(res.notificationsSent).toBe(3);
  });

  it('recomputes active asset readiness and creates snapshot on status flip (RDY-06)', async () => {
    const overdueCandidate: AssetRecomputeCandidate = {
      id: 'ast-1',
      code: 'EP01',
      baselineApproved: true,
      retired: false,
      currentReadinessStatus: 'READY',
      currentReadinessReasons: [
        {
          code: 'ALL_CRITICAL_PASS',
          message: 'ฟังก์ชันวิกฤตล่าสุดผ่านครบและไม่มีข้อขัดข้องที่ยังไม่ปิด',
        },
      ],
      readinessFacts: {
        criticalChecks: [{ key: 'sos_btn', label: 'ปุ่ม SOS', result: 'PASS' }],
        openCriticalFault: false,
        openNonCriticalIssue: false,
        nextDueAt: new Date('2026-07-20T00:00:00Z'), // Overdue within grace period
      },
    };

    const { port, persistedSnapshots } = portWith([], {
      candidates: [overdueCandidate],
    });

    const res = await runJobTick(port, { now });
    expect(res.assetsRecomputed).toBe(1);
    expect(res.readinessFlips).toBe(1);
    expect(persistedSnapshots).toHaveLength(1);
    expect(persistedSnapshots[0].status).toBe('WATCH');
    expect(persistedSnapshots[0].reasons[0].code).toBe('OVERDUE_WITHIN_GRACE');
  });

  it('does NOT write duplicate snapshot when readiness status and reasons remain unchanged', async () => {
    const unchangedCandidate: AssetRecomputeCandidate = {
      id: 'ast-2',
      code: 'EP02',
      baselineApproved: true,
      retired: false,
      currentReadinessStatus: 'READY',
      currentReadinessReasons: [
        {
          code: 'ALL_CRITICAL_PASS',
          message: 'ฟังก์ชันวิกฤตล่าสุดผ่านครบและไม่มีข้อขัดข้องที่ยังไม่ปิด',
        },
      ],
      readinessFacts: {
        criticalChecks: [{ key: 'sos_btn', label: 'ปุ่ม SOS', result: 'PASS' }],
        openCriticalFault: false,
        openNonCriticalIssue: false,
        nextDueAt: new Date('2026-07-25T00:00:00Z'), // Still in future
      },
    };

    const { port, persistedSnapshots } = portWith([], {
      candidates: [unchangedCandidate],
    });

    const res = await runJobTick(port, { now });
    expect(res.assetsRecomputed).toBe(1);
    expect(res.readinessFlips).toBe(0);
    expect(persistedSnapshots).toHaveLength(0);
  });
});
