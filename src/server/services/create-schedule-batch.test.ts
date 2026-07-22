import { describe, expect, it, vi } from 'vitest';
import {
  createScheduleBatch,
  ScheduleError,
  type PlanForSchedule,
  type ScheduleCreatePort,
} from './create-schedule-batch';
import { ForbiddenError } from '@/domain/authz/policy';
import type { AppRole } from '@/domain/work/types';

const activePlan: PlanForSchedule = {
  id: 'plan-1',
  kind: 'MONTHLY_FIELD',
  assetTypeKey: 'SOS_POLE',
  checklistVersionId: 'ver-1',
  active: true,
};

function portWith(plan: PlanForSchedule | null, created = 5): ScheduleCreatePort {
  return {
    loadPlan: vi.fn(async () => plan),
    createBatchWithWorkOrders: vi.fn(async () => ({ batchId: 'batch-1', workOrdersCreated: created })),
  };
}

const planner: { userId: string; roles: AppRole[] } = { userId: 'p1', roles: ['PLANNER'] };
const now = new Date('2026-07-22T00:00:00Z');

describe('createScheduleBatch', () => {
  it('denies a role without schedule:create', async () => {
    await expect(
      createScheduleBatch(portWith(activePlan), {
        planId: 'plan-1', name: 'รอบ ก.ค.', actor: { userId: 't', roles: ['TECHNICIAN'] }, now,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('errors when the plan is missing', async () => {
    await expect(
      createScheduleBatch(portWith(null), { planId: 'x', name: 'n', actor: planner, now }),
    ).rejects.toMatchObject({ code: 'PLAN_NOT_FOUND' });
  });

  it('errors when the plan is inactive', async () => {
    await expect(
      createScheduleBatch(portWith({ ...activePlan, active: false }), {
        planId: 'plan-1', name: 'n', actor: planner, now,
      }),
    ).rejects.toMatchObject({ code: 'PLAN_INACTIVE' });
  });

  it('errors when the plan has no checklist version', async () => {
    await expect(
      createScheduleBatch(portWith({ ...activePlan, checklistVersionId: null }), {
        planId: 'plan-1', name: 'n', actor: planner, now,
      }),
    ).rejects.toBeInstanceOf(ScheduleError);
  });

  it('creates a DRAFT batch, passes the creator, and reports generated work orders', async () => {
    let capturedCreatedById: string | undefined;
    const port: ScheduleCreatePort = {
      loadPlan: vi.fn(async () => activePlan),
      createBatchWithWorkOrders: vi.fn(async (input) => {
        capturedCreatedById = input.createdById;
        return { batchId: 'batch-1', workOrdersCreated: 27 };
      }),
    };
    const res = await createScheduleBatch(port, {
      planId: 'plan-1', name: 'รอบรายเดือน', actor: planner, now,
    });
    expect(res).toEqual({ batchId: 'batch-1', status: 'DRAFT', workOrdersCreated: 27 });
    expect(capturedCreatedById).toBe('p1'); // persisted for SoD
  });
});
