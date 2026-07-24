import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  ChecklistVersionError,
  publishChecklistVersion,
  repointPlanToVersion,
  retireChecklistVersion,
} from './checklist-version';
import { getSyncBootstrap } from '../queries/sync';

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);
const REQUIRED = ['sos_button'];

let templateId: string;
let v1Id: string;
let v2Id: string;
let planId: string;
let assetTypeId: string;
let locationId: string;
let assetId: string;
let workOrderId: string;
let weeklyTemplateId: string;
let weeklyVersionId: string;

async function makeVersion(version: number): Promise<string> {
  const v = await prisma.checklistTemplateVersion.create({
    data: {
      templateId, version, status: 'DRAFT',
      items: { create: [{ order: 1, code: `sos_${version}`, label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' }] },
      fieldGroups: { create: [{ key: 'g_sos', label: 'กดปุ่ม SOS', order: 1, required: true }] },
    },
    select: { id: true, fieldGroups: { select: { id: true } } },
  });
  await prisma.checklistItem.update({ where: { versionId_code: { versionId: v.id, code: `sos_${version}` } }, data: { fieldGroupId: v.fieldGroups[0].id, memberOrder: 1 } });
  return v.id;
}

beforeAll(async () => {
  const t = await prisma.checklistTemplate.create({ data: { key: `TPL_CV_${suffix}`, name: 'cv', kind: 'MONTHLY_FIELD' } });
  templateId = t.id;
  v1Id = await makeVersion(1);
  v2Id = await makeVersion(2);
  await publishChecklistVersion(prisma, v1Id, REQUIRED);
  const plan = await prisma.maintenancePlan.create({ data: { name: 'cv-plan', kind: 'MONTHLY_FIELD', frequency: 'MONTHLY', assetTypeKey: `CV_${suffix}`, checklistVersionId: v1Id } });
  planId = plan.id;
  const at = await prisma.assetType.create({ data: { key: `CVAT_${suffix}`, name: 'cv' } });
  assetTypeId = at.id;
  const loc = await prisma.location.create({ data: { code: `CVLOC_${suffix}`, name: 'cv', longitude: 100.1, latitude: 15.7 } });
  locationId = loc.id;
  const asset = await prisma.asset.create({ data: { code: `CVEP_${suffix}`, name: 'cv', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_cv_${suffix}`, lifecycle: 'ACTIVE' } });
  assetId = asset.id;
  const wo = await prisma.workOrder.create({ data: { code: `WO-CV-${suffix}`, kind: 'MONTHLY_FIELD', assetId, planId, checklistVersionId: v1Id, status: 'ASSIGNED' } });
  workOrderId = wo.id;

  // A published WEEKLY version (different template kind) for the kind-mismatch test.
  const wt = await prisma.checklistTemplate.create({ data: { key: `TPL_WK_${suffix}`, name: 'wk', kind: 'WEEKLY_CENTER' } });
  weeklyTemplateId = wt.id;
  const wv = await prisma.checklistTemplateVersion.create({
    data: {
      templateId: weeklyTemplateId, version: 1, status: 'DRAFT',
      items: { create: [{ order: 1, code: `w_sos_${suffix}`, label: 'ปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' }] },
      fieldGroups: { create: [{ key: 'g_wsos', label: 'กดปุ่ม SOS', order: 1, required: true }] },
    },
    select: { id: true, fieldGroups: { select: { id: true } } },
  });
  weeklyVersionId = wv.id;
  await prisma.checklistItem.update({ where: { versionId_code: { versionId: weeklyVersionId, code: `w_sos_${suffix}` } }, data: { fieldGroupId: wv.fieldGroups[0].id, memberOrder: 1 } });
  await publishChecklistVersion(prisma, weeklyVersionId, REQUIRED);
});

afterAll(async () => {
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.maintenancePlan.deleteMany({ where: { id: planId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.checklistItem.deleteMany({ where: { versionId: { in: [v1Id, v2Id, weeklyVersionId] } } });
  await prisma.checklistFieldGroup.deleteMany({ where: { checklistVersionId: { in: [v1Id, v2Id, weeklyVersionId] } } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: { in: [v1Id, v2Id, weeklyVersionId] } } });
  await prisma.checklistTemplate.deleteMany({ where: { id: { in: [templateId, weeklyTemplateId] } } });
  await prisma.$disconnect();
});

describe('checklist-version lifecycle', () => {
  it('repoint rejects a DRAFT (not-published) version', async () => {
    await expect(repointPlanToVersion(prisma, planId, v2Id)).rejects.toBeInstanceOf(ChecklistVersionError);
  });

  it('publishing v2 freezes it and then allows repoint; the pinned work order keeps v1 groups', async () => {
    await publishChecklistVersion(prisma, v2Id, REQUIRED);
    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({ where: { id: v2Id } });
    expect(v2.status).toBe('PUBLISHED');
    expect(v2.isLocked).toBe(true);

    await repointPlanToVersion(prisma, planId, v2Id);
    const plan = await prisma.maintenancePlan.findUniqueOrThrow({ where: { id: planId } });
    expect(plan.checklistVersionId).toBe(v2Id);

    // Version pinning: the existing work order still shows v1's groups (its pinned version).
    const boot = await getSyncBootstrap(null, new Date(), prisma);
    const wo = boot.workOrders.find((w) => w.code === `WO-CV-${suffix}`)!;
    expect(wo.groups[0].members[0].memberKey).toBe('sos_1');
  });

  it('repoint rejects a published version whose template kind differs from the plan', async () => {
    // The monthly plan must never point at a WEEKLY version, even though it is published.
    let err: unknown;
    try { await repointPlanToVersion(prisma, planId, weeklyVersionId); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ChecklistVersionError);
    expect((err as ChecklistVersionError).code).toBe('KIND_MISMATCH');
    const plan = await prisma.maintenancePlan.findUniqueOrThrow({ where: { id: planId } });
    expect(plan.checklistVersionId).toBe(v2Id); // unchanged
  });

  it('retire is blocked while an active plan references the version, then succeeds', async () => {
    await expect(retireChecklistVersion(prisma, v2Id)).rejects.toBeInstanceOf(ChecklistVersionError);
    await prisma.maintenancePlan.update({ where: { id: planId }, data: { active: false } });
    await retireChecklistVersion(prisma, v2Id);
    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({ where: { id: v2Id } });
    expect(v2.status).toBe('RETIRED');
    expect(v2.retiredAt).not.toBeNull();
  });

  it('publishing a RETIRED version is refused (never resurrected)', async () => {
    let err: unknown;
    try { await publishChecklistVersion(prisma, v2Id, REQUIRED); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ChecklistVersionError);
    expect((err as ChecklistVersionError).code).toBe('VERSION_RETIRED');
    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({ where: { id: v2Id } });
    expect(v2.status).toBe('RETIRED'); // unchanged
  });
});
