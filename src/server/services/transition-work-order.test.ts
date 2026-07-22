import { describe, expect, it, vi } from 'vitest';
import {
  transitionWorkOrder,
  WorkOrderTransitionError,
  type ApplyTransitionInput,
  type WorkOrderState,
  type WorkOrderTransitionPort,
} from './transition-work-order';

function portFor(
  state: WorkOrderState | null,
): { port: WorkOrderTransitionPort; applied: ApplyTransitionInput[] } {
  const applied: ApplyTransitionInput[] = [];
  const port: WorkOrderTransitionPort = {
    loadByCode: vi.fn(async () => state),
    applyTransition: vi.fn(async (input) => {
      applied.push(input);
      return { status: input.to, version: state ? state.version + 1 : 1 };
    }),
  };
  return { port, applied };
}

const draft: WorkOrderState = {
  id: 'wo-1',
  code: 'WO-1',
  status: 'DRAFT',
  kind: 'MONTHLY_FIELD',
  version: 3,
};

describe('transitionWorkOrder', () => {
  it('throws WORKORDER_NOT_FOUND when the code is unknown', async () => {
    const { port } = portFor(null);
    await expect(
      transitionWorkOrder(port, {
        code: 'NOPE',
        to: 'ASSIGNED',
        actor: { userId: 'p1', roles: ['PLANNER'] },
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'WORKORDER_NOT_FOUND' });
  });

  it('applies an allowed transition and passes the optimistic version', async () => {
    const { port, applied } = portFor(draft);
    const res = await transitionWorkOrder(port, {
      code: 'WO-1',
      to: 'ASSIGNED',
      actor: { userId: 'p1', roles: ['PLANNER'] },
      now: new Date(),
    });
    expect(res).toMatchObject({ from: 'DRAFT', status: 'ASSIGNED', version: 4 });
    expect(applied[0]).toMatchObject({ to: 'ASSIGNED', expectedVersion: 3 });
  });

  it('rejects an edge not in the graph', async () => {
    const { port } = portFor(draft);
    await expect(
      transitionWorkOrder(port, {
        code: 'WO-1',
        to: 'CLOSED',
        actor: { userId: 'p1', roles: ['PLANNER'] },
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(WorkOrderTransitionError);
  });

  it('rejects when no role permits (executive)', async () => {
    const { port } = portFor(draft);
    await expect(
      transitionWorkOrder(port, {
        code: 'WO-1',
        to: 'ASSIGNED',
        actor: { userId: 'e1', roles: ['EXECUTIVE'] },
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'TRANSITION_NOT_ALLOWED' });
  });

  it('allows when any of the actor roles permits (executive + planner)', async () => {
    const { port } = portFor(draft);
    const res = await transitionWorkOrder(port, {
      code: 'WO-1',
      to: 'ASSIGNED',
      actor: { userId: 'p1', roles: ['EXECUTIVE', 'PLANNER'] },
      now: new Date(),
    });
    expect(res.status).toBe('ASSIGNED');
  });
});
