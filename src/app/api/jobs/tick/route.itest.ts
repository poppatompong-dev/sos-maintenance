import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';
import { createPrismaJobTickPort } from '@/server/adapters/prisma-job-tick-port';

/**
 * Integration test for GET /api/jobs/tick — cron-secret gating, in-app dispatch,
 * and the P1 concurrency guarantee: overlapping ticks send a notification at
 * most once (conditional PENDING→SENT claim).
 */
const prisma = new PrismaClient();
const runId = randomUUID().slice(0, 8);
const SECRET = `test-cron-${runId}`;
const originalSecret = process.env.CRON_SECRET;
const createdKeys: string[] = [];

async function newPendingInApp(): Promise<{ id: string }> {
  const key = `notif:test:${runId}:${randomUUID()}`;
  createdKeys.push(key);
  const n = await prisma.notification.create({
    data: {
      channel: 'IN_APP',
      type: 'ASSET_DOWN',
      subject: 'ทดสอบ',
      body: 'ทดสอบ tick',
      status: 'PENDING',
      idempotencyKey: key,
    },
    select: { id: true },
  });
  return n;
}

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { idempotencyKey: { in: createdKeys } } });
  await prisma.$disconnect();
});

function tick(auth?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (auth) headers.authorization = auth;
  return GET(new Request('http://local/api/jobs/tick', { headers }));
}

describe('GET /api/jobs/tick — gating', () => {
  it('503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET;
    expect((await tick(`Bearer ${SECRET}`)).status).toBe(503);
  });

  it('401 on a wrong/absent secret', async () => {
    process.env.CRON_SECRET = SECRET;
    expect((await tick()).status).toBe(401);
    expect((await tick('Bearer nope')).status).toBe(401);
  });
});

describe('GET /api/jobs/tick — dispatch', () => {
  it('dispatches a pending in-app notification exactly once', async () => {
    process.env.CRON_SECRET = SECRET;
    const { id } = await newPendingInApp();
    const res = await tick(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notificationsSent).toBeGreaterThanOrEqual(1);
    expect(typeof body.assetsInScope).toBe('number');

    const n = await prisma.notification.findUniqueOrThrow({ where: { id } });
    expect(n.status).toBe('SENT');
    expect(n.sentAt).not.toBeNull();
    expect(n.attempts).toBe(1);
  });
});

describe('GET /api/jobs/tick — concurrency (P1)', () => {
  it('sends at most once under two overlapping ticks', async () => {
    process.env.CRON_SECRET = SECRET;
    const { id } = await newPendingInApp();

    // Fire two ticks concurrently — both may select the same PENDING row.
    const [a, b] = await Promise.all([tick(`Bearer ${SECRET}`), tick(`Bearer ${SECRET}`)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const n = await prisma.notification.findUniqueOrThrow({ where: { id } });
    expect(n.status).toBe('SENT');
    expect(n.attempts).toBe(1); // exactly one tick claimed it — no double-send
  });

  it('conditional claim: the second tryMark on the same row loses (CAS)', async () => {
    const port = createPrismaJobTickPort(prisma);
    const { id } = await newPendingInApp();
    const now = new Date();

    const first = await port.tryMarkNotificationSent(id, now);
    const second = await port.tryMarkNotificationSent(id, now);
    expect(first).toBe(true);
    expect(second).toBe(false);

    const n = await prisma.notification.findUniqueOrThrow({ where: { id } });
    expect(n.attempts).toBe(1);
  });
});
