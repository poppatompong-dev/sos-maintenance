import { describe, expect, it } from 'vitest';
import { allowedNextStatuses, canTransition } from './state-machine';
import type { TransitionContext } from './state-machine';

const base = (over: Partial<TransitionContext>): TransitionContext => ({
  from: 'DRAFT',
  to: 'PUBLISHED',
  kind: 'MONTHLY_FIELD',
  actorRole: 'PLANNER',
  actorUserId: 'planner-1',
  ...over,
});

describe('transition graph', () => {
  it('exposes allowed next statuses', () => {
    expect(allowedNextStatuses('SUBMITTED')).toEqual(['CLOSED', 'REJECTED']);
    expect(allowedNextStatuses('CANCELLED')).toEqual([]);
  });

  it('rejects a transition not in the graph', () => {
    const r = canTransition(base({ from: 'DRAFT', to: 'CLOSED' }));
    expect(r.allowed).toBe(false);
  });
});

describe('role permissions', () => {
  it('planner may publish; technician may not', () => {
    expect(canTransition(base({ actorRole: 'PLANNER' })).allowed).toBe(true);
    expect(canTransition(base({ actorRole: 'TECHNICIAN' })).allowed).toBe(false);
  });

  it('technician starts work; planner may not', () => {
    const ctx = { from: 'ASSIGNED', to: 'IN_PROGRESS' } as const;
    expect(canTransition(base({ ...ctx, actorRole: 'TECHNICIAN' })).allowed).toBe(true);
    expect(canTransition(base({ ...ctx, actorRole: 'PLANNER' })).allowed).toBe(false);
  });

  it('technician submits work', () => {
    expect(
      canTransition(
        base({ from: 'IN_PROGRESS', to: 'SUBMITTED', actorRole: 'TECHNICIAN' }),
      ).allowed,
    ).toBe(true);
  });

  it('executive can do nothing operational', () => {
    expect(canTransition(base({ actorRole: 'EXECUTIVE' })).allowed).toBe(false);
  });

  it('admin may perform planner transitions', () => {
    expect(canTransition(base({ actorRole: 'SYSTEM_ADMIN' })).allowed).toBe(true);
  });
});

describe('acceptance (SUBMITTED -> CLOSED) & separation of duties', () => {
  const accept = (over: Partial<TransitionContext>) =>
    canTransition(base({ from: 'SUBMITTED', to: 'CLOSED', ...over }));

  it('planner accepts work submitted by someone else', () => {
    expect(
      accept({ actorRole: 'PLANNER', actorUserId: 'p1', submittedByUserId: 'tech-9' })
        .allowed,
    ).toBe(true);
  });

  it('planner CANNOT accept their own submission (separation of duties)', () => {
    const r = accept({
      actorRole: 'PLANNER',
      actorUserId: 'same',
      submittedByUserId: 'same',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('แยกหน้าที่');
  });

  it('technician may self-close a passing recurring PM', () => {
    expect(
      accept({
        actorRole: 'TECHNICIAN',
        kind: 'WEEKLY_CENTER',
        allChecklistPassed: true,
        actorUserId: 'tech-1',
        submittedByUserId: 'tech-1',
      }).allowed,
    ).toBe(true);
  });

  it('technician may NOT self-close a corrective job', () => {
    expect(
      accept({
        actorRole: 'TECHNICIAN',
        kind: 'CORRECTIVE',
        allChecklistPassed: true,
        actorUserId: 'tech-1',
      }).allowed,
    ).toBe(false);
  });

  it('technician may NOT self-close a failing PM', () => {
    expect(
      accept({
        actorRole: 'TECHNICIAN',
        kind: 'MONTHLY_FIELD',
        allChecklistPassed: false,
      }).allowed,
    ).toBe(false);
  });

  it('initial survey must be Planner-approved (no technician self-close)', () => {
    expect(
      accept({
        actorRole: 'TECHNICIAN',
        kind: 'INITIAL_SURVEY',
        allChecklistPassed: true,
      }).allowed,
    ).toBe(false);
  });
});

describe('rework & cancellation', () => {
  it('planner rejects submitted work', () => {
    expect(
      canTransition(base({ from: 'SUBMITTED', to: 'REJECTED' })).allowed,
    ).toBe(true);
  });

  it('technician resumes rejected work', () => {
    expect(
      canTransition(
        base({ from: 'REJECTED', to: 'IN_PROGRESS', actorRole: 'TECHNICIAN' }),
      ).allowed,
    ).toBe(true);
  });

  it('planner reopens a closed work order', () => {
    expect(canTransition(base({ from: 'CLOSED', to: 'REOPENED' })).allowed).toBe(true);
  });

  it('technician cannot cancel', () => {
    expect(
      canTransition(base({ from: 'ASSIGNED', to: 'CANCELLED', actorRole: 'TECHNICIAN' }))
        .allowed,
    ).toBe(false);
  });
});
