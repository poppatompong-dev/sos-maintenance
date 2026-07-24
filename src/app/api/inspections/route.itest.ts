import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const LAT = 15.7;
const LNG = 100.12;

let assetTypeId: string;
let locationId: string;
let assetId: string;
let templateId: string;
let versionId: string;
let groupId: string;
let workOrderId: string;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const assetType = await prisma.assetType.create({ data: { key: `SOS_POLE_API_${suffix}`, name: 'api-test' } });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({ data: { code: `LOCAPI_${suffix}`, name: 'จุด', longitude: LNG, latitude: LAT } });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: {
      code: `EPAPI_${suffix}`, name: 'เสา api', assetTypeId, locationId, longitude: LNG, latitude: LAT,
      qrToken: `qr_api_${suffix}`, lifecycle: 'ACTIVE', baselineApproved: true, currentReadiness: 'UNKNOWN',
      components: { create: [{ key: 'sos_button', name: 'ปุ่ม SOS', criticality: 'CRITICAL' }] },
    },
  });
  assetId = asset.id;
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_API_${suffix}`, name: 'tpl', kind: 'MONTHLY_FIELD' } },
      version: 1, status: 'PUBLISHED', publishedAt: new Date(), isLocked: true,
      items: {
        create: [
          { order: 1, code: 'it_sos', label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
          { order: 2, code: 'it_note', label: 'หมายเหตุ', kind: 'TEXT', criticality: 'NON_CRITICAL' },
        ],
      },
    },
  });
  versionId = version.id;
  templateId = version.templateId;
  const group = await prisma.checklistFieldGroup.create({ data: { checklistVersionId: versionId, key: 'g_sos', label: 'กดปุ่ม SOS', order: 1, required: true } });
  groupId = group.id;
  await prisma.checklistItem.update({ where: { versionId_code: { versionId, code: 'it_sos' } }, data: { fieldGroupId: groupId, memberOrder: 1 } });
  const wo = await prisma.workOrder.create({ data: { code: `WO-API-${suffix}`, kind: 'MONTHLY_FIELD', assetId, checklistVersionId: versionId, status: 'IN_PROGRESS' } });
  workOrderId = wo.id;
});

afterAll(async () => {
  await prisma.checklistResponse.deleteMany({ where: { workOrderId } });
  await prisma.readinessSnapshot.deleteMany({ where: { assetId } });
  await prisma.fault.deleteMany({ where: { assetId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistFieldGroup.deleteMany({ where: { checklistVersionId: versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.assetComponent.deleteMany({ where: { assetId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function envelope(payload: unknown) {
  return {
    mutationId: randomUUID(), deviceId: `dev_${suffix}`, entity: 'checklist_response',
    action: 'create', baseVersion: null, clientOccurredAt: new Date().toISOString(),
    payloadChecksum: 'sum', payload,
  };
}
function post(body: unknown, roles = 'TECHNICIAN'): Promise<Response> {
  return POST(new Request('http://local/api/inspections', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-dev-roles': roles, 'x-dev-user': 'tech1' },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/inspections (grouped)', () => {
  it('401 when unauthenticated', async () => {
    const res = await POST(new Request('http://local/api/inspections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'NORMAL' }], gps: { lat: LAT, lng: LNG } })) }));
    expect(res.status).toBe(401);
  });

  it('403 when role lacks workorder:submit', async () => {
    const res = await post(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'NORMAL' }], gps: { lat: LAT, lng: LNG } }), 'EXECUTIVE');
    expect(res.status).toBe(403);
  });

  it('400 on an empty groups array', async () => {
    const res = await post(envelope({ workOrderId, groups: [], gps: { lat: LAT, lng: LNG } }));
    expect(res.status).toBe(400);
  });

  it('NORMAL → READY, expands to per-item responses + note, idempotent replay', async () => {
    const body = envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'NORMAL' }], generalNote: 'ปกติดี', gps: { lat: LAT, lng: LNG } });
    const first = await post(body);
    expect(first.status).toBe(201);
    expect((await first.json()).readiness.status).toBe('READY');

    const responses = await prisma.checklistResponse.findMany({ where: { workOrderId }, include: { item: true } });
    const sos = responses.find((r) => r.item.code === 'it_sos')!;
    const note = responses.find((r) => r.item.code === 'it_note')!;
    expect(sos.result).toBe('PASS');
    expect(note.result).toBe('NA');
    expect(note.note).toBe('ปกติดี');

    const replay = await post(body);
    expect(replay.status).toBe(200);
    expect((await replay.json()).idempotentReplay).toBe(true);
    expect(await prisma.checklistResponse.count({ where: { workOrderId, item: { code: 'it_sos' } } })).toBe(1);
  });

  it('PROBLEM on a critical member → DOWN + fault; UNTESTABLE → not READY', async () => {
    // Fresh work order state each assertion via a new mutationId; asset readiness is recomputed.
    const down = await post(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'PROBLEM', members: [{ memberKey: 'it_sos', state: 'PROBLEM' }], note: 'ปุ่มไม่ทำงาน' }], gps: { lat: LAT, lng: LNG } }));
    expect(down.status).toBe(201);
    const downJson = await down.json();
    expect(downJson.readiness.status).toBe('DOWN');
    expect(downJson.faults.some((f: { severity: string }) => f.severity === 'CRITICAL')).toBe(true);

    const untestable = await post(envelope({ workOrderId, groups: [{ groupKey: 'g_sos', outcome: 'UNTESTABLE', reason: 'เข้าพื้นที่ไม่ได้' }], gps: { lat: LAT, lng: LNG } }));
    expect(untestable.status).toBe(201);
    expect((await untestable.json()).readiness.status).not.toBe('READY');
  });
});
