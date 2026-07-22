import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET, POST as CREATE } from './route';
import { POST as TRANSITION } from './[id]/transition/route';

/**
 * Integration test: schedule-batch planning lifecycle over the API, including
 * separation of duties (creator ≠ approver) and concurrency-safe work-order code
 * allocation. Self-contained fixtures with two planners A (creator) and B
 * (approver).
 */
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const KEY = `SOS_SCHED_${suffix}`;

let userA: string; // creator
let userB: string; // approver
let assetTypeId: string;
let locationId: string;
const assetIds: string[] = [];
let versionId: string;
let templateId: string;
let planId: string;
let batchId: string;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const a = await prisma.user.create({ data: { username: `planA_${suffix}`, displayName: 'ผู้สร้าง', roles: ['PLANNER'] } });
  const b = await prisma.user.create({ data: { username: `planB_${suffix}`, displayName: 'ผู้อนุมัติ', roles: ['PLANNER'] } });
  userA = a.id;
  userB = b.id;
  const at = await prisma.assetType.create({ data: { key: KEY, name: 'sched' } });
  assetTypeId = at.id;
  const loc = await prisma.location.create({ data: { code: `LOCSC_${suffix}`, name: 'sc', longitude: 100.1, latitude: 15.7 } });
  locationId = loc.id;
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_SC_${suffix}`, name: 'sc', kind: 'MONTHLY_FIELD' } },
      version: 1,
      publishedAt: new Date(),
      items: { create: [{ order: 1, code: 'x', label: 'x', kind: 'BOOLEAN_PASS_FAIL', criticality: 'NON_CRITICAL' }] },
    },
  });
  versionId = version.id;
  templateId = version.templateId;
  const plan = await prisma.maintenancePlan.create({
    data: { name: 'แผนทดสอบ', kind: 'MONTHLY_FIELD', frequency: 'MONTHLY', assetTypeKey: KEY, checklistVersionId: versionId, active: true },
  });
  planId = plan.id;
  for (let i = 0; i < 2; i++) {
    const asset = await prisma.asset.create({
      data: { code: `EPSC_${suffix}_${i}`, name: `sc${i}`, assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_sc_${suffix}_${i}`, lifecycle: 'ACTIVE' },
    });
    assetIds.push(asset.id);
  }
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { assetId: { in: assetIds } } });
  await prisma.scheduleBatch.deleteMany({ where: { planId } });
  await prisma.maintenancePlan.deleteMany({ where: { id: planId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.asset.deleteMany({ where: { id: { in: assetIds } } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
  await prisma.$disconnect();
});

function createReq(body: unknown, roles?: string, user?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (roles) headers['x-dev-roles'] = roles;
  if (user) headers['x-dev-user'] = user;
  return new Request('http://local/api/schedule-batches', { method: 'POST', headers, body: JSON.stringify(body) });
}
function getReq(user: string): Request {
  return new Request('http://local/api/schedule-batches', { headers: { 'x-dev-roles': 'PLANNER', 'x-dev-user': user } });
}
function transition(id: string, to: string, roles: string, user: string) {
  return TRANSITION(
    new Request(`http://local/api/schedule-batches/${id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dev-roles': roles, 'x-dev-user': user },
      body: JSON.stringify({ to }),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe('schedule-batch lifecycle + SoD + concurrency', () => {
  it('401 create without a session', async () => {
    expect((await CREATE(createReq({ planId, name: 'n' }))).status).toBe(401);
  });

  it('403 create for a technician', async () => {
    expect((await CREATE(createReq({ planId, name: 'n' }, 'TECHNICIAN', userA))).status).toBe(403);
  });

  it('creates a DRAFT batch (creator recorded) with one WO per active asset', async () => {
    const res = await CREATE(createReq({ planId, name: 'รอบทดสอบ' }, 'PLANNER', userA));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('DRAFT');
    expect(body.workOrdersCreated).toBe(2);
    batchId = body.batchId;

    const batch = await prisma.scheduleBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.createdById).toBe(userA);
    const wos = await prisma.workOrder.findMany({ where: { scheduleBatchId: batchId } });
    expect(wos).toHaveLength(2);
    expect(wos.every((w) => w.status === 'DRAFT' && /^WO-\d{4}-\d{4}$/.test(w.code))).toBe(true);
  });

  it('lists the batch with its work-order count', async () => {
    const res = await GET(getReq(userA));
    expect(res.status).toBe(200);
    const body = await res.json();
    const mine = body.batches.find((b: { id: string }) => b.id === batchId);
    expect(mine?.workOrderCount).toBe(2);
  });

  it('409 on an invalid edge DRAFT→PUBLISHED', async () => {
    expect((await transition(batchId, 'PUBLISHED', 'PLANNER', userB)).status).toBe(409);
  });

  it('403 transition for a technician', async () => {
    expect((await transition(batchId, 'APPROVED', 'TECHNICIAN', userB)).status).toBe(403);
  });

  it('SoD: the creator (A) cannot approve their own batch', async () => {
    const res = await transition(batchId, 'APPROVED', 'PLANNER', userA);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('SELF_APPROVAL_FORBIDDEN');
    const batch = await prisma.scheduleBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(batch.status).toBe('DRAFT'); // unchanged
  });

  it('SoD: a legacy batch with unknown creator (null) cannot be approved', async () => {
    const legacy = await prisma.scheduleBatch.create({
      data: { planId, name: 'legacy', status: 'DRAFT', createdById: null },
    });
    const res = await transition(legacy.id, 'APPROVED', 'PLANNER', userB);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('CREATOR_UNKNOWN');
    const b = await prisma.scheduleBatch.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(b.status).toBe('DRAFT'); // unchanged
    await prisma.scheduleBatch.deleteMany({ where: { id: legacy.id } });
  });

  it('a distinct approver (B) can approve, then publish releases the work orders', async () => {
    const approve = await transition(batchId, 'APPROVED', 'PLANNER', userB);
    expect(approve.status).toBe(200);
    const b1 = await prisma.scheduleBatch.findUniqueOrThrow({ where: { id: batchId } });
    expect(b1.approverId).toBe(userB);
    expect(b1.approvedAt).not.toBeNull();

    const publish = await transition(batchId, 'PUBLISHED', 'PLANNER', userB);
    expect(publish.status).toBe(200);
    const published = await prisma.workOrder.count({ where: { scheduleBatchId: batchId, status: 'PUBLISHED' } });
    expect(published).toBe(2);
  });

  it('allocates distinct WO codes under two concurrent batch creates', async () => {
    const [r1, r2] = await Promise.all([
      CREATE(createReq({ planId, name: 'c1' }, 'PLANNER', userA)),
      CREATE(createReq({ planId, name: 'c2' }, 'PLANNER', userA)),
    ]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const wos = await prisma.workOrder.findMany({ where: { assetId: { in: assetIds } }, select: { code: true } });
    const codes = wos.map((w) => w.code);
    // 2 (lifecycle) + 2 + 2 (concurrent) = 6, all unique — no unique-constraint race.
    expect(codes.length).toBe(6);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
