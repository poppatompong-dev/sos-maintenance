import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';

/**
 * Integration test for POST /api/inspections — exercises the full HTTP slice:
 * dev auth guard -> Zod parse -> submit service -> Prisma -> Postgres. Runs under
 * `pnpm test:integration` with a live DATABASE_URL. Self-contained fixture.
 */

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const LAT = 15.7;
const LNG = 100.12;

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
  const assetType = await prisma.assetType.create({
    data: { key: `SOS_POLE_API_${suffix}`, name: 'api-test' },
  });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({
    data: { code: `LOCAPI_${suffix}`, name: 'จุด', longitude: LNG, latitude: LAT },
  });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: {
      code: `EPAPI_${suffix}`,
      name: 'เสา api',
      assetTypeId,
      locationId,
      longitude: LNG,
      latitude: LAT,
      qrToken: `qr_api_${suffix}`,
      lifecycle: 'ACTIVE',
      baselineApproved: true,
      currentReadiness: 'UNKNOWN',
      components: {
        create: [{ key: 'sos_button', name: 'ปุ่ม SOS', criticality: 'CRITICAL' }],
      },
    },
  });
  assetId = asset.id;
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: {
        create: { key: `TPL_API_${suffix}`, name: 'tpl', kind: 'MONTHLY_FIELD' },
      },
      version: 1,
      publishedAt: new Date(),
      items: {
        create: [
          { order: 1, code: 'it_sos', label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
        ],
      },
    },
    include: { template: true },
  });
  versionId = version.id;
  templateId = version.templateId;
  const wo = await prisma.workOrder.create({
    data: { code: `WO-API-${suffix}`, kind: 'MONTHLY_FIELD', assetId, checklistVersionId: versionId, status: 'IN_PROGRESS' },
  });
  workOrderId = wo.id;
});

afterAll(async () => {
  await prisma.checklistResponse.deleteMany({ where: { workOrderId } });
  await prisma.readinessSnapshot.deleteMany({ where: { assetId } });
  await prisma.fault.deleteMany({ where: { assetId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.assetComponent.deleteMany({ where: { assetId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function body() {
  return {
    mutationId: randomUUID(),
    deviceId: `dev_${suffix}`,
    entity: 'checklist_response',
    action: 'create',
    baseVersion: null,
    clientOccurredAt: new Date().toISOString(),
    payloadChecksum: 'sum',
    payload: {
      workOrderId,
      responses: [
        { itemCode: 'it_sos', label: 'ปุ่ม SOS', result: 'PASS', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
      ],
      gps: { lat: LAT, lng: LNG },
    },
  };
}

function post(payload: unknown, roles = 'TECHNICIAN'): Promise<Response> {
  return POST(
    new Request('http://local/api/inspections', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dev-roles': roles, 'x-dev-user': 'tech1' },
      body: JSON.stringify(payload),
    }),
  );
}

describe('POST /api/inspections', () => {
  it('401 when unauthenticated', async () => {
    const res = await POST(
      new Request('http://local/api/inspections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body()),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('403 when role lacks workorder:submit', async () => {
    const res = await post(body(), 'EXECUTIVE');
    expect(res.status).toBe(403);
  });

  it('400 on invalid body', async () => {
    const res = await post({ nope: true });
    expect(res.status).toBe(400);
  });

  it('201 and READY on a passing submit, then 200 idempotent replay', async () => {
    const payload = body();
    const first = await post(payload);
    expect(first.status).toBe(201);
    const firstJson = await first.json();
    expect(firstJson.readiness.status).toBe('READY');

    const replay = await post(payload);
    expect(replay.status).toBe(200);
    const replayJson = await replay.json();
    expect(replayJson.idempotentReplay).toBe(true);
  });
});
