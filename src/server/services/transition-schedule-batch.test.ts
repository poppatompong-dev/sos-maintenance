import { describe, expect, it, vi } from 'vitest';
import {
  transitionScheduleBatch,
  type ApplyBatchTransitionInput,
  type BatchTransitionPort,
  type ScheduleBatchState,
} from './transition-schedule-batch';
import type { AppRole } from '@/domain/work/types';

function portFor(state: ScheduleBatchState | null) {
  const applied: ApplyBatchTransitionInput[] = [];
  const port: BatchTransitionPort = {
    loadBatchById: vi.fn(async () => state),
    applyBatchTransition: vi.fn(async (input) => {
      applied.push(input);
      return { status: input.to, version: (state?.version ?? 0) + 1 };
    }),
  };
  return { port, applied };
}

const draft: ScheduleBatchState = { id: 'b1', status: 'DRAFT', version: 2, createdById: 'creator-1' };
const planner: { userId: string; roles: AppRole[] } = { userId: 'p1', roles: ['PLANNER'] };
const now = new Date('2026-07-22T00:00:00Z');

describe('transitionScheduleBatch', () => {
  it('errors when the batch is missing', async () => {
    const { port } = portFor(null);
    await expect(
      transitionScheduleBatch(port, { id: 'x', to: 'APPROVED', actor: planner, now }),
    ).rejects.toMatchObject({ code: 'BATCH_NOT_FOUND' });
  });

  it('rejects an invalid edge (DRAFT→PUBLISHED)', async () => {
    const { port } = portFor(draft);
    await expect(
      transitionScheduleBatch(port, { id: 'b1', to: 'PUBLISHED', actor: planner, now }),
    ).rejects.toMatchObject({ code: 'BATCH_TRANSITION_NOT_ALLOWED' });
  });

  it('approves DRAFT→APPROVED and records the approver + version', async () => {
    const { port, applied } = portFor(draft);
    const res = await transitionScheduleBatch(port, { id: 'b1', to: 'APPROVED', actor: planner, now });
    expect(res).toMatchObject({ from: 'DRAFT', status: 'APPROVED', version: 3 });
    expect(applied[0]).toMatchObject({ to: 'APPROVED', approverId: 'p1', expectedVersion: 2 });
  });

  it('publishes APPROVED→PUBLISHED without an approverId', async () => {
    const { port, applied } = portFor({ id: 'b1', status: 'APPROVED', version: 4, createdById: 'creator-1' });
    const res = await transitionScheduleBatch(port, { id: 'b1', to: 'PUBLISHED', actor: planner, now });
    expect(res.status).toBe('PUBLISHED');
    expect(applied[0].approverId).toBeUndefined();
  });

  it('blocks self-approval (approver === creator) — separation of duties', async () => {
    const { port, applied } = portFor({ id: 'b1', status: 'DRAFT', version: 2, createdById: 'p1' });
    await expect(
      transitionScheduleBatch(port, { id: 'b1', to: 'APPROVED', actor: planner, now }),
    ).rejects.toMatchObject({ code: 'SELF_APPROVAL_FORBIDDEN' });
    expect(applied).toHaveLength(0); // never persisted
  });

  it('rejects approval of a legacy batch with unknown creator (null)', async () => {
    const { port, applied } = portFor({ id: 'b1', status: 'DRAFT', version: 2, createdById: null });
    await expect(
      transitionScheduleBatch(port, { id: 'b1', to: 'APPROVED', actor: planner, now }),
    ).rejects.toMatchObject({ code: 'CREATOR_UNKNOWN' });
    expect(applied).toHaveLength(0);
  });
});
