import { describe, expect, it, vi } from 'vitest';
import { runJobTick, type JobTickPort, type PendingNotification } from './run-job-tick';

/**
 * In-memory port with a CAS-accurate `tryMarkNotificationSent`: it succeeds only
 * the first time an id is claimed, mirroring the conditional PENDING→SENT update.
 */
function portWith(
  pending: PendingNotification[],
  opts: { assets?: number; alreadySent?: string[] } = {},
) {
  const claimed = new Set(opts.alreadySent ?? []);
  const port: JobTickPort = {
    claimPendingNotifications: vi.fn(async (limit) => pending.slice(0, limit)),
    tryMarkNotificationSent: vi.fn(async (id) => {
      if (claimed.has(id)) return false; // lost the race / already sent
      claimed.add(id);
      return true;
    }),
    countActiveAssets: vi.fn(async () => opts.assets ?? 27),
  };
  return { port, claimed };
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
    expect(res).toMatchObject({ notificationsSent: 0, notificationsDeferred: 0, assetsInScope: 27 });
  });

  it('bounds the batch by the limit', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, channel: 'IN_APP' }));
    const { port } = portWith(many);
    const res = await runJobTick(port, { now, limit: 3 });
    expect(res.notificationsSent).toBe(3);
  });
});
