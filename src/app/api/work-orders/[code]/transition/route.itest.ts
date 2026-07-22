import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';

/**
 * Integration test: the full work-order lifecycle over the transition API
 * (DRAFT → ASSIGNED → IN_PROGRESS → SUBMITTED → CLOSED) against Postgres,
 * including role gating, separation of duties, and an invalid-edge 409.
 */

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const TECH = randomUUID();
const PLANNER = randomUUID();

let assetTypeId: string;
let locationId: string;
let assetId: string;
let workOrderId: string;
const CODE = `WO-LC-${suffix}`;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const assetType = await prisma.assetType.create({ data: { key: `SOS_LC_${suffix}`, name: 'lc' } });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({ data: { code: `LOCLC_${suffix}`, name: 'lc', longitude: 100.1, latitude: 15.7 } });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: {
      code: `EPLC_${suffix}`, name: 'lc', assetTypeId, locationId,
      longitude: 100.1, latitude: 15.7, qrToken: `qr_lc_${suffix}`, lifecycle: 'ACTIVE',
    },
  });
  assetId = asset.id;
  const wo = await prisma.workOrder.create({
    data: { code: CODE, kind: 'MONTHLY_FIELD', assetId, status: 'DRAFT' },
  });
  workOrderId = wo.id;
});

afterAll(async () => {
  await prisma.workLog.deleteMany({ where: { workOrderId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function post(to: string, roles: string, userId: string, note?: string): Promise<Response> {
  return POST(
    new Request(`http://local/api/work-orders/${CODE}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dev-roles': roles, 'x-dev-user': userId },
      body: JSON.stringify({ to, note }),
    }),
    { params: Promise.resolve({ code: CODE }) },
  );
}

describe('POST /api/work-orders/:code/transition', () => {
  it('401 without a session', async () => {
    const res = await POST(
      new Request(`http://local/api/work-orders/${CODE}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: 'ASSIGNED' }),
      }),
      { params: Promise.resolve({ code: CODE }) },
    );
    expect(res.status).toBe(401);
  });

  it('403 when a technician tries to assign', async () => {
    const res = await post('ASSIGNED', 'TECHNICIAN', TECH);
    expect(res.status).toBe(403);
  });

  it('runs the full lifecycle to CLOSED with separation of duties', async () => {
    expect((await post('ASSIGNED', 'PLANNER', PLANNER)).status).toBe(200);
    expect((await post('IN_PROGRESS', 'TECHNICIAN', TECH)).status).toBe(200);
    expect((await post('SUBMITTED', 'TECHNICIAN', TECH)).status).toBe(200);

    const closed = await post('CLOSED', 'PLANNER', PLANNER);
    expect(closed.status).toBe(200);
    const body = await closed.json();
    expect(body.status).toBe('CLOSED');
    expect(body.version).toBe(4);

    const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    expect(wo.startedAt).not.toBeNull();
    expect(wo.submittedAt).not.toBeNull();
    expect(wo.closedAt).not.toBeNull();
    const logs = await prisma.workLog.count({ where: { workOrderId } });
    expect(logs).toBe(4);
  });

  it('409 on an invalid edge from CLOSED (planner→ASSIGNED)', async () => {
    const res = await post('ASSIGNED', 'PLANNER', PLANNER);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('TRANSITION_NOT_ALLOWED');
  });

  it('blocks self-acceptance (separation of duties)', async () => {
    // Fresh WO submitted and accepted by the SAME user → domain denies at CLOSED.
    const code2 = `WO-SD-${suffix}`;
    const wo2 = await prisma.workOrder.create({
      data: { code: code2, kind: 'MONTHLY_FIELD', assetId, status: 'SUBMITTED', version: 0 },
    });
    await prisma.workLog.create({
      data: { workOrderId: wo2.id, fromStatus: 'IN_PROGRESS', toStatus: 'SUBMITTED', actorId: PLANNER, occurredAt: new Date() },
    });
    const res = await POST(
      new Request(`http://local/api/work-orders/${code2}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dev-roles': 'PLANNER', 'x-dev-user': PLANNER },
        body: JSON.stringify({ to: 'CLOSED' }),
      }),
      { params: Promise.resolve({ code: code2 }) },
    );
    expect(res.status).toBe(409);
    await prisma.workLog.deleteMany({ where: { workOrderId: wo2.id } });
    await prisma.workOrder.deleteMany({ where: { id: wo2.id } });
  });
});
