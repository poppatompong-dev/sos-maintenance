import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';

/**
 * Integration test for GET /api/maintenance-plans — the active-plan catalog that
 * feeds the schedule-batch creation form. Self-contained fixtures: one active
 * plan, one retired (inactive) plan that must not appear.
 */
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const KEY = `SOS_MP_${suffix}`;

let versionId: string;
let templateId: string;
let activePlanId: string;
let inactivePlanId: string;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_MP_${suffix}`, name: 'mp', kind: 'MONTHLY_FIELD' } },
      version: 1,
      publishedAt: new Date(),
      items: { create: [{ order: 1, code: 'x', label: 'x', kind: 'BOOLEAN_PASS_FAIL', criticality: 'NON_CRITICAL' }] },
    },
  });
  versionId = version.id;
  templateId = version.templateId;

  const active = await prisma.maintenancePlan.create({
    data: { name: `แผนใช้งาน ${suffix}`, kind: 'MONTHLY_FIELD', frequency: 'MONTHLY', assetTypeKey: KEY, checklistVersionId: versionId, active: true },
  });
  activePlanId = active.id;
  const inactive = await prisma.maintenancePlan.create({
    data: { name: `แผนปิด ${suffix}`, kind: 'SEMIANNUAL_DEEP', frequency: 'SEMIANNUAL', assetTypeKey: `${KEY}_B`, checklistVersionId: versionId, active: false },
  });
  inactivePlanId = inactive.id;
});

afterAll(async () => {
  await prisma.maintenancePlan.deleteMany({ where: { id: { in: [activePlanId, inactivePlanId] } } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.$disconnect();
});

function get(roles?: string): Request {
  const headers: Record<string, string> = {};
  if (roles) headers['x-dev-roles'] = roles;
  return new Request('http://local/api/maintenance-plans', { headers });
}

describe('GET /api/maintenance-plans', () => {
  it('401 without a session', async () => {
    expect((await GET(get())).status).toBe(401);
  });

  it('lists only active plans', async () => {
    const res = await GET(get('PLANNER'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const codes = body.plans.map((p: { id: string }) => p.id);
    expect(codes).toContain(activePlanId);
    expect(codes).not.toContain(inactivePlanId);
  });
});
