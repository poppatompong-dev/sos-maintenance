import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let userId: string;
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
  const user = await prisma.user.create({ data: { username: `tech_${suffix}`, displayName: 'ช่างทดสอบ', roles: ['TECHNICIAN'] } });
  userId = user.id;
  const at = await prisma.assetType.create({ data: { key: `SOS_SB_${suffix}`, name: 'sb' } });
  assetTypeId = at.id;
  const loc = await prisma.location.create({ data: { code: `LOCSB_${suffix}`, name: 'sb', longitude: 100.1, latitude: 15.7 } });
  locationId = loc.id;
  const asset = await prisma.asset.create({ data: { code: `EPSB_${suffix}`, name: 'sb', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_sb_${suffix}`, lifecycle: 'ACTIVE' } });
  assetId = asset.id;
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_SB_${suffix}`, name: 'sb', kind: 'MONTHLY_FIELD' } },
      version: 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      isLocked: true,
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
  const group = await prisma.checklistFieldGroup.create({
    data: { checklistVersionId: versionId, key: 'g_sos', label: 'กดปุ่ม SOS แล้วมีไฟและเสียง', order: 1, required: true },
  });
  groupId = group.id;
  await prisma.checklistItem.update({ where: { versionId_code: { versionId, code: 'sb_sos' } }, data: { fieldGroupId: groupId, memberOrder: 1 } });
  const wo = await prisma.workOrder.create({ data: { code: `WO-SB-${suffix}`, kind: 'MONTHLY_FIELD', assetId, checklistVersionId: versionId, status: 'ASSIGNED' } });
  workOrderId = wo.id;
  await prisma.assignment.create({ data: { workOrderId, userId } });
});

afterAll(async () => {
  await prisma.assignment.deleteMany({ where: { workOrderId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistFieldGroup.deleteMany({ where: { checklistVersionId: versionId } });
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

describe('GET /api/sync/bootstrap (grouped)', () => {
  it('401 without a session', async () => {
    const res = await GET(new Request('http://local/api/sync/bootstrap'));
    expect(res.status).toBe(401);
  });

  it('returns grouped structure with no kind/criticality/function leakage', async () => {
    const res = await GET(get(userId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workOrders).toHaveLength(1);
    const wo = body.workOrders[0];
    expect(wo.groups).toHaveLength(1);
    expect(wo.groups[0].label).toBe('กดปุ่ม SOS แล้วมีไฟและเสียง');
    expect(wo.groups[0].members[0].memberKey).toBe('sb_sos');
    expect(wo.groups[0].members[0].label).toBe('ปุ่ม SOS');
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('criticalFunctionKey');
    expect(raw).not.toContain('CRITICAL');
    expect(raw).not.toContain('BOOLEAN_PASS_FAIL');
    expect(wo).not.toHaveProperty('checklist');
  });
});
