// prisma/demo-fixture.itest.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createDemoFixture,
  DEMO_ASSET_CODE,
  DEMO_ASSET_TYPE_KEY,
  INTERNAL_ACTOR_ID,
} from './demo-fixture';

/**
 * Real-Postgres proof that the guarded demo fixture is idempotent: two calls
 * produce exactly one work order and one assignment, wired to EP01, the monthly
 * checklist/plan, and the internal actor, in ASSIGNED status.
 *
 * PRECONDITION: `pnpm db:setup` (migrate + PostGIS + seed) has been run against
 * this DATABASE_URL — the same step CI's `integration` job runs. This test does
 * NOT fabricate reference data; it asserts the seed exists and fails clearly if
 * it does not.
 *
 * It uses a work-order code distinct from the owner-visible demo code so its
 * teardown can never delete a real demo work order or submitted evidence. The
 * integration work order is never submitted, so deleting it + its assignment in
 * teardown is safe.
 */
const ITEST_WORK_ORDER_CODE = 'DEMO-LOCAL-EP01-MONTHLY-ITEST';
const prisma = new PrismaClient();

async function assertSeededReferences(): Promise<void> {
  const [asset, plan, actor] = await Promise.all([
    prisma.asset.findUnique({ where: { code: DEMO_ASSET_CODE } }),
    prisma.maintenancePlan.findUnique({
      where: {
        kind_assetTypeKey: { kind: 'MONTHLY_FIELD', assetTypeKey: DEMO_ASSET_TYPE_KEY },
      },
    }),
    prisma.user.findUnique({ where: { id: INTERNAL_ACTOR_ID } }),
  ]);

  const missing: string[] = [];
  if (!asset) missing.push('asset EP01');
  if (!plan) missing.push('monthly maintenance plan');
  if (!actor) missing.push('internal-operator actor');
  if (missing.length > 0) {
    throw new Error(
      `Seeded references missing (${missing.join(', ')}). Run \`pnpm db:setup\` ` +
        'before this integration test.',
    );
  }
}

async function cleanupItestWorkOrder(): Promise<void> {
  const wo = await prisma.workOrder.findUnique({ where: { code: ITEST_WORK_ORDER_CODE } });
  if (!wo) return;
  await prisma.assignment.deleteMany({ where: { workOrderId: wo.id } });
  await prisma.workOrder.delete({ where: { id: wo.id } });
}

beforeAll(async () => {
  await assertSeededReferences(); // fail clearly if `pnpm db:setup` has not run
  await cleanupItestWorkOrder(); // start from a known-clean state
});

afterAll(async () => {
  await cleanupItestWorkOrder();
  await prisma.$disconnect();
});

describe('createDemoFixture (integration)', () => {
  it('creates exactly one ASSIGNED demo work order wired to EP01/monthly/internal actor', async () => {
    const first = await createDemoFixture(prisma, { workOrderCode: ITEST_WORK_ORDER_CODE });

    expect(first.created).toBe(true);
    expect(first.workOrderCode).toBe(ITEST_WORK_ORDER_CODE);
    expect(first.status).toBe('ASSIGNED');
    expect(first.assetCode).toBe(DEMO_ASSET_CODE);
    expect(first.assignedUserId).toBe(INTERNAL_ACTOR_ID);

    const wo = await prisma.workOrder.findUniqueOrThrow({
      where: { code: ITEST_WORK_ORDER_CODE },
      include: { asset: true, plan: true, checklistVersion: true, assignments: true },
    });
    expect(wo.status).toBe('ASSIGNED');
    expect(wo.asset.code).toBe(DEMO_ASSET_CODE);
    expect(wo.planId).not.toBeNull();
    expect(wo.checklistVersionId).not.toBeNull();
    expect(wo.assignments).toHaveLength(1);
    expect(wo.assignments[0].userId).toBe(INTERNAL_ACTOR_ID);
  });

  it('is idempotent: a second call creates no duplicate work order or assignment', async () => {
    const second = await createDemoFixture(prisma, { workOrderCode: ITEST_WORK_ORDER_CODE });
    expect(second.created).toBe(false);
    expect(second.workOrderCode).toBe(ITEST_WORK_ORDER_CODE);

    const workOrders = await prisma.workOrder.count({ where: { code: ITEST_WORK_ORDER_CODE } });
    const wo = await prisma.workOrder.findUniqueOrThrow({ where: { code: ITEST_WORK_ORDER_CODE } });
    const assignments = await prisma.assignment.count({ where: { workOrderId: wo.id } });

    expect(workOrders).toBe(1);
    expect(assignments).toBe(1);
  });
});
