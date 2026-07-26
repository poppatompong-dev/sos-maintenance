import { describe, expect, it } from 'vitest';
import {
  BASELINE_DENIAL,
  canApproveBaseline,
  type BaselineApprovalContext,
} from './baseline';

/**
 * Happy-path context: a Planner approving an asset whose INITIAL_SURVEY work
 * order was submitted by a technician and accepted (CLOSED) by someone else.
 */
const base = (over: Partial<BaselineApprovalContext> = {}): BaselineApprovalContext => ({
  actorRole: 'PLANNER',
  actorUserId: 'planner-1',
  alreadyApproved: false,
  assetRetired: false,
  survey: {
    kind: 'INITIAL_SURVEY',
    status: 'CLOSED',
    submittedByUserId: 'tech-1',
  },
  ...over,
});

describe('canApproveBaseline — happy path', () => {
  it('allows a Planner to approve after an accepted initial survey', () => {
    expect(canApproveBaseline(base())).toEqual({ allowed: true });
  });

  it('allows a System Admin (Planner override)', () => {
    expect(canApproveBaseline(base({ actorRole: 'SYSTEM_ADMIN' })).allowed).toBe(true);
  });
});

describe('canApproveBaseline — who may approve', () => {
  it('denies a technician', () => {
    const r = canApproveBaseline(base({ actorRole: 'TECHNICIAN', actorUserId: 'tech-9' }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.NOT_AUTHORIZED);
  });

  it('denies an executive (read-only role)', () => {
    const r = canApproveBaseline(base({ actorRole: 'EXECUTIVE', actorUserId: 'exec-1' }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.NOT_AUTHORIZED);
  });
});

describe('canApproveBaseline — evidence is mandatory', () => {
  it('denies when the asset has no initial survey at all', () => {
    const r = canApproveBaseline(base({ survey: undefined }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.SURVEY_MISSING);
  });

  it('denies when the survey is only SUBMITTED (not yet accepted)', () => {
    const r = canApproveBaseline(
      base({ survey: { kind: 'INITIAL_SURVEY', status: 'SUBMITTED', submittedByUserId: 'tech-1' } }),
    );
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.SURVEY_NOT_ACCEPTED);
  });

  it('denies when the survey was rejected', () => {
    const r = canApproveBaseline(
      base({ survey: { kind: 'INITIAL_SURVEY', status: 'REJECTED', submittedByUserId: 'tech-1' } }),
    );
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.SURVEY_NOT_ACCEPTED);
  });

  it('denies when the cited work order is not an initial survey', () => {
    const r = canApproveBaseline(
      base({ survey: { kind: 'MONTHLY_FIELD', status: 'CLOSED', submittedByUserId: 'tech-1' } }),
    );
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.SURVEY_WRONG_KIND);
  });
});

describe('canApproveBaseline — separation of duties', () => {
  it('denies approving a survey the actor submitted themselves', () => {
    const r = canApproveBaseline(
      base({
        actorUserId: 'planner-1',
        survey: { kind: 'INITIAL_SURVEY', status: 'CLOSED', submittedByUserId: 'planner-1' },
      }),
    );
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.SELF_APPROVAL);
  });

  it('allows when the submitter is a different person', () => {
    expect(
      canApproveBaseline(
        base({
          actorUserId: 'planner-2',
          survey: { kind: 'INITIAL_SURVEY', status: 'CLOSED', submittedByUserId: 'planner-1' },
        }),
      ).allowed,
    ).toBe(true);
  });

  it('denies when the submitter is unknown — cannot prove duties were separated', () => {
    const r = canApproveBaseline(
      base({ survey: { kind: 'INITIAL_SURVEY', status: 'CLOSED', submittedByUserId: undefined } }),
    );
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.SUBMITTER_UNKNOWN);
  });
});

describe('canApproveBaseline — asset state', () => {
  it('denies re-approving an already approved baseline', () => {
    const r = canApproveBaseline(base({ alreadyApproved: true }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.ALREADY_APPROVED);
  });

  it('denies approving a retired asset', () => {
    const r = canApproveBaseline(base({ assetRetired: true }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe(BASELINE_DENIAL.ASSET_RETIRED);
  });
});

describe('canApproveBaseline — denial messages', () => {
  it('every denial carries a Thai reason', () => {
    const denials = [
      canApproveBaseline(base({ actorRole: 'TECHNICIAN' })),
      canApproveBaseline(base({ survey: undefined })),
      canApproveBaseline(base({ alreadyApproved: true })),
      canApproveBaseline(base({ assetRetired: true })),
    ];
    for (const d of denials) {
      expect(d.allowed).toBe(false);
      expect(d.reason).toBeTruthy();
      // Thai script present — the UI never shows a bare enum to an operator.
      expect(d.reason).toMatch(/[฀-๿]/);
    }
  });
});
