// prisma/demo-fixture.ts
//
// Idempotent LOCAL demo fixture. Resolves reference data created by
// `pnpm db:setup` (asset EP01, the monthly checklist/plan, the internal actor)
// and creates exactly one clearly labelled demo work order plus its assignment
// inside a single transaction. Re-running leaves the existing work order and
// assignment unchanged. This module performs IO and must only ever be invoked
// after `evaluateDemoGuard` has returned ok (enforced by prisma/seed-demo.ts).

import { MaintenanceKind, WorkOrderStatus, type PrismaClient } from '@prisma/client';

/** Public, stable identifiers for the demo fixture (also used by docs/tests). */
export const DEMO_WORK_ORDER_CODE = 'DEMO-LOCAL-EP01-MONTHLY';
export const DEMO_ASSET_CODE = 'EP01';
export const DEMO_ASSET_TYPE_KEY = 'SOS_POLE';
export const INTERNAL_ACTOR_ID = '00000000-0000-0000-0000-000000000001';

export interface DemoFixtureResult {
  readonly workOrderId: string;
  readonly workOrderCode: string;
  readonly status: WorkOrderStatus;
  readonly assetCode: string;
  readonly assignedUserId: string;
  /** false when a pre-existing fixture was returned unchanged (idempotent replay). */
  readonly created: boolean;
}

export interface CreateDemoFixtureOptions {
  /**
   * Override the work-order code. The CLI always uses the public default
   * `DEMO_WORK_ORDER_CODE`; the integration test passes a distinct code so its
   * cleanup can never touch the owner-visible demo work order or any submitted
   * immutable evidence.
   */
  readonly workOrderCode?: string;
}

export class MissingReferenceError extends Error {
  constructor(what: string) {
    super(`Missing reference data (${what}). Run \`pnpm db:setup\` first, then re-run.`);
    this.name = 'MissingReferenceError';
  }
}

/**
 * Create (or return unchanged) the single local demo work order on EP01, wired
 * to the seeded monthly checklist/plan and assigned to the internal actor.
 * Throws MissingReferenceError if `pnpm db:setup` has not populated references.
 */
export async function createDemoFixture(
  prisma: PrismaClient,
  options: CreateDemoFixtureOptions = {},
): Promise<DemoFixtureResult> {
  const workOrderCode = options.workOrderCode ?? DEMO_WORK_ORDER_CODE;
  return prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({ where: { code: DEMO_ASSET_CODE } });
    if (!asset) throw new MissingReferenceError('asset EP01');

    const plan = await tx.maintenancePlan.findUnique({
      where: {
        kind_assetTypeKey: {
          kind: MaintenanceKind.MONTHLY_FIELD,
          assetTypeKey: DEMO_ASSET_TYPE_KEY,
        },
      },
    });
    if (!plan) throw new MissingReferenceError('monthly maintenance plan');

    const actor = await tx.user.findUnique({ where: { id: INTERNAL_ACTOR_ID } });
    if (!actor) throw new MissingReferenceError('internal-operator actor');

    const existing = await tx.workOrder.findUnique({
      where: { code: workOrderCode },
    });

    const workOrder =
      existing ??
      (await tx.workOrder.create({
        data: {
          code: workOrderCode,
          kind: MaintenanceKind.MONTHLY_FIELD,
          assetId: asset.id,
          planId: plan.id,
          checklistVersionId: plan.checklistVersionId,
          status: WorkOrderStatus.ASSIGNED,
        },
      }));

    // Idempotent assignment: unique on (workOrderId, userId).
    await tx.assignment.upsert({
      where: {
        workOrderId_userId: { workOrderId: workOrder.id, userId: actor.id },
      },
      update: {},
      create: { workOrderId: workOrder.id, userId: actor.id },
    });

    return {
      workOrderId: workOrder.id,
      workOrderCode: workOrder.code,
      status: workOrder.status,
      assetCode: asset.code,
      assignedUserId: actor.id,
      created: existing === null,
    };
  });
}
