// prisma/checklist-v2.itest.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { rolloutMonthlyV2 } from './checklist-v2';

/**
 * Integration proof that rolloutMonthlyV2 is safe + idempotent against the seeded
 * monthly template/plan. PRECONDITION: `pnpm db:setup` has run (CI's integration
 * job does this). This test never fabricates reference data; it fails clearly if
 * the seed is absent.
 */
const prisma = new PrismaClient();

beforeAll(async () => {
  const template = await prisma.checklistTemplate.findUnique({ where: { key: 'MONTHLY_FIELD' } });
  if (!template) throw new Error('Seed missing: run `pnpm db:setup` before this integration test.');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('rolloutMonthlyV2 (integration)', () => {
  it('is idempotent: exactly one PUBLISHED v2 with 5 groups / 10 items, plan repointed', async () => {
    const first = await rolloutMonthlyV2(prisma);
    const second = await rolloutMonthlyV2(prisma);
    expect(second.created).toBe(false);
    expect(second.versionId).toBe(first.versionId);

    const template = await prisma.checklistTemplate.findUniqueOrThrow({ where: { key: 'MONTHLY_FIELD' } });
    const versions = await prisma.checklistTemplateVersion.findMany({ where: { templateId: template.id, version: 2 } });
    expect(versions).toHaveLength(1);
    expect(versions[0].status).toBe('PUBLISHED');

    const v2 = await prisma.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: first.versionId },
      include: { fieldGroups: true, items: true },
    });
    expect(v2.fieldGroups).toHaveLength(5);
    expect(v2.items).toHaveLength(10);
    const ungrouped = v2.items.filter((it) => it.fieldGroupId === null).map((it) => it.code);
    expect(ungrouped).toEqual(['m_note']); // only the general note is ungrouped

    const plan = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
    expect(plan.checklistVersionId).toBe(first.versionId);
  });

  it('refuses to trust/repoint an existing PUBLISHED v2 whose stored content drifted (label or order)', async () => {
    const ok = await rolloutMonthlyV2(prisma); // canonical steady state
    const before = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
    expect(before.checklistVersionId).toBe(ok.versionId);

    // Capture the original so the shared reference data can be restored exactly.
    const item = await prisma.checklistItem.findFirstOrThrow({ where: { versionId: ok.versionId, code: 'm_sos_button' } });
    try {
      // (a) LABEL drift on the published v2 -> fingerprint mismatch -> refuse, no repoint.
      await prisma.checklistItem.update({ where: { id: item.id }, data: { label: 'DRIFTED' } });
      await expect(rolloutMonthlyV2(prisma)).rejects.toThrow(/does not match the expected definition/);
      let plan = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
      expect(plan.checklistVersionId).toBe(ok.versionId); // unchanged — never repointed
      await prisma.checklistItem.update({ where: { id: item.id }, data: { label: item.label } });

      // (b) ORDER drift -> fingerprint mismatch -> refuse, no repoint.
      await prisma.checklistItem.update({ where: { id: item.id }, data: { order: 999 } });
      await expect(rolloutMonthlyV2(prisma)).rejects.toThrow(/does not match the expected definition/);
      plan = await prisma.maintenancePlan.findFirstOrThrow({ where: { kind: 'MONTHLY_FIELD', assetTypeKey: 'SOS_POLE' } });
      expect(plan.checklistVersionId).toBe(ok.versionId); // unchanged — never repointed
    } finally {
      // Restore exact original label + order so the DB steady state is intact.
      await prisma.checklistItem.update({ where: { id: item.id }, data: { label: item.label, order: item.order } });
    }
  });
});
