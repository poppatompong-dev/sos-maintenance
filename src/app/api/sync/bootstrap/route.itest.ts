import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';

/**
 * Integration test for GET /api/sync/bootstrap — a technician's assigned offline
 * work set (work orders + checklist definitions) from Postgres.
 */
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let userId: string;
let assetTypeId: string;
let locationId: string;
let assetId: string;
let templateId: string;
let versionId: string;
let workOrderId: string;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { username: `tech_${suffix}`, displayName: 'ช่างทดสอบ', roles: ['TECHNICIAN'] },
  });
  userId = user.id;
  const at = await prisma.assetType.create({ data: { key: `SOS_SB_${suffix}`, name: 'sb' } });
  assetTypeId = at.id;
  const loc = await prisma.location.create({ data: { code: `LOCSB_${suffix}`, name: 'sb', longitude: 100.1, latitude: 15.7 } });
  locationId = loc.id;
  const asset = await prisma.asset.create({
    data: { code: `EPSB_${suffix}`, name: 'sb', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_sb_${suffix}`, lifecycle: 'ACTIVE' },
  });
  assetId = asset.id;
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_SB_${suffix}`, name: 'sb', kind: 'MONTHLY_FIELD' } },
      version: 1,
      publishedAt: new Date(),
      items: {
        create: [
          { order: 1, code: 'sb_sos', label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
          { order: 2, code: 'sb_note', label: 'หมายเหตุ', kind: 'TEXT', criticality: 'NON_CRITICAL' },
        ],
      },
    },
  });
  versionId = version.id;
  templateId = version.templateId;
  const wo = await prisma.workOrder.create({
    data: { code: `WO-SB-${suffix}`, kind: 'MONTHLY_FIELD', assetId, checklistVersionId: versionId, status: 'ASSIGNED' },
  });
  workOrderId = wo.id;
  await prisma.assignment.create({ data: { workOrderId, userId } });
});

afterAll(async () => {
  await prisma.assignment.deleteMany({ where: { workOrderId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

function get(user?: string): Request {
  const headers: Record<string, string> = { 'x-dev-roles': 'TECHNICIAN' };
  if (user) headers['x-dev-user'] = user;
  return new Request('http://local/api/sync/bootstrap', { headers });
}

describe('GET /api/sync/bootstrap', () => {
  it('401 without a session', async () => {
    const res = await GET(new Request('http://local/api/sync/bootstrap'));
    expect(res.status).toBe(401);
  });

  it("returns the technician's assigned work with checklist items", async () => {
    const res = await GET(get(userId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workOrders).toHaveLength(1);
    expect(body.workOrders[0].id).toBe(workOrderId);
    expect(body.workOrders[0].asset.code).toBe(`EPSB_${suffix}`);
    expect(body.workOrders[0].checklist).toHaveLength(2);
    expect(body.workOrders[0].checklist[0].code).toBe('sb_sos');
  });

  it('returns an empty set for a technician with no assignments', async () => {
    const res = await GET(get(randomUUID()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workOrders).toEqual([]);
  });
});
