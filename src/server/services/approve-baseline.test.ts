import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../domain/authz/policy';
import {
  approveBaseline,
  BaselineApprovalError,
  type ApproveBaselinePort,
  type BaselineAssetState,
  type PersistBaselineApprovalInput,
} from './approve-baseline';

function portFor(state: BaselineAssetState | null): {
  port: ApproveBaselinePort;
  persisted: PersistBaselineApprovalInput[];
} {
  const persisted: PersistBaselineApprovalInput[] = [];
  const port: ApproveBaselinePort = {
    loadByCode: vi.fn(async () => state),
    persist: vi.fn(async (input) => {
      persisted.push(input);
    }),
  };
  return { port, persisted };
}

const NOW = new Date('2026-07-26T03:00:00.000Z');

/** An asset whose initial survey was submitted by tech-1 and accepted. */
const surveyed = (over: Partial<BaselineAssetState> = {}): BaselineAssetState => ({
  assetId: 'asset-1',
  code: 'EP01',
  baselineApproved: false,
  retired: false,
  version: 4,
  survey: {
    workOrderId: 'wo-survey-1',
    kind: 'INITIAL_SURVEY',
    status: 'CLOSED',
    submittedByUserId: 'tech-1',
  },
  readinessFacts: {
    criticalChecks: [
      { key: 'sos_button', label: 'ปุ่ม SOS', result: 'PASS' },
      { key: 'network_voip', label: 'เครือข่าย/VoIP', result: 'PASS' },
    ],
    openCriticalFault: false,
    openNonCriticalIssue: false,
    nextDueAt: new Date('2026-08-26T03:00:00.000Z'),
  },
  ...over,
});

const plannerCmd = {
  code: 'EP01',
  actor: { userId: 'planner-1', roles: ['PLANNER'] as const },
  now: NOW,
};

describe('approveBaseline — authorization', () => {
  it('rejects a technician before loading anything', async () => {
    const { port } = portFor(surveyed());
    await expect(
      approveBaseline(port, {
        ...plannerCmd,
        actor: { userId: 'tech-1', roles: ['TECHNICIAN'] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(port.loadByCode).not.toHaveBeenCalled();
  });

  it('rejects an executive (read-only)', async () => {
    const { port } = portFor(surveyed());
    await expect(
      approveBaseline(port, {
        ...plannerCmd,
        actor: { userId: 'exec-1', roles: ['EXECUTIVE'] },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('approveBaseline — happy path', () => {
  it('records the approver, the moment, and the survey it rests on', async () => {
    const { port, persisted } = portFor(surveyed());
    const result = await approveBaseline(port, {
      ...plannerCmd,
      actor: { userId: 'planner-1', roles: ['PLANNER'] },
    });

    expect(result.code).toBe('EP01');
    expect(result.approverUserId).toBe('planner-1');
    expect(result.approvedAt).toEqual(NOW);
    expect(result.surveyWorkOrderId).toBe('wo-survey-1');

    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      assetId: 'asset-1',
      approverUserId: 'planner-1',
      surveyWorkOrderId: 'wo-survey-1',
      expectedVersion: 4,
    });
  });

  it('recomputes readiness with the baseline approved and persists the snapshot', async () => {
    const { port, persisted } = portFor(surveyed());
    const result = await approveBaseline(port, {
      ...plannerCmd,
      actor: { userId: 'planner-1', roles: ['PLANNER'] },
    });

    // All critical functions pass, nothing overdue, no open fault → READY.
    expect(result.readiness.status).toBe('READY');
    expect(result.readiness.reasons.map((r) => r.code)).not.toContain(
      'NO_APPROVED_BASELINE',
    );
    // The snapshot handed to the adapter is the same computed result.
    expect(persisted[0].readiness).toEqual(result.readiness);
  });

  it('does NOT force READY — a failing critical function still computes DOWN', async () => {
    const { port } = portFor(
      surveyed({
        readinessFacts: {
          criticalChecks: [
            { key: 'sos_button', label: 'ปุ่ม SOS', result: 'FAIL' },
            { key: 'network_voip', label: 'เครือข่าย/VoIP', result: 'PASS' },
          ],
          openCriticalFault: false,
          openNonCriticalIssue: false,
          nextDueAt: new Date('2026-08-26T03:00:00.000Z'),
        },
      }),
    );
    const result = await approveBaseline(port, {
      ...plannerCmd,
      actor: { userId: 'planner-1', roles: ['PLANNER'] },
    });
    expect(result.readiness.status).toBe('DOWN');
  });

  it('does NOT force READY — a missing critical result still computes UNKNOWN', async () => {
    const { port } = portFor(
      surveyed({
        readinessFacts: {
          criticalChecks: [
            { key: 'sos_button', label: 'ปุ่ม SOS', result: 'UNKNOWN' },
            { key: 'network_voip', label: 'เครือข่าย/VoIP', result: 'PASS' },
          ],
          openCriticalFault: false,
          openNonCriticalIssue: false,
          nextDueAt: new Date('2026-08-26T03:00:00.000Z'),
        },
      }),
    );
    const result = await approveBaseline(port, {
      ...plannerCmd,
      actor: { userId: 'planner-1', roles: ['PLANNER'] },
    });
    // Approving the baseline removes NO_APPROVED_BASELINE, but the pole is
    // still UNKNOWN for a different, honest reason.
    expect(result.readiness.status).toBe('UNKNOWN');
    expect(result.readiness.reasons.map((r) => r.code)).not.toContain(
      'NO_APPROVED_BASELINE',
    );
  });

  it('accepts a SYSTEM_ADMIN acting as Planner', async () => {
    const { port } = portFor(surveyed());
    const result = await approveBaseline(port, {
      ...plannerCmd,
      actor: { userId: 'admin-1', roles: ['SYSTEM_ADMIN'] },
    });
    expect(result.approverUserId).toBe('admin-1');
  });
});

describe('approveBaseline — refusals carry the domain code', () => {
  it('unknown asset', async () => {
    const { port } = portFor(null);
    await expect(
      approveBaseline(port, { ...plannerCmd, actor: { userId: 'p', roles: ['PLANNER'] } }),
    ).rejects.toMatchObject({ code: 'ASSET_NOT_FOUND' });
  });

  it('no initial survey yet', async () => {
    const { port, persisted } = portFor(surveyed({ survey: undefined }));
    await expect(
      approveBaseline(port, { ...plannerCmd, actor: { userId: 'p', roles: ['PLANNER'] } }),
    ).rejects.toMatchObject({ code: 'SURVEY_MISSING' });
    expect(persisted).toHaveLength(0);
  });

  it('survey submitted but not yet accepted', async () => {
    const { port } = portFor(
      surveyed({
        survey: {
          workOrderId: 'wo-survey-1',
          kind: 'INITIAL_SURVEY',
          status: 'SUBMITTED',
          submittedByUserId: 'tech-1',
        },
      }),
    );
    await expect(
      approveBaseline(port, { ...plannerCmd, actor: { userId: 'p', roles: ['PLANNER'] } }),
    ).rejects.toMatchObject({ code: 'SURVEY_NOT_ACCEPTED' });
  });

  it('separation of duties — approver submitted the survey', async () => {
    const { port } = portFor(
      surveyed({
        survey: {
          workOrderId: 'wo-survey-1',
          kind: 'INITIAL_SURVEY',
          status: 'CLOSED',
          submittedByUserId: 'planner-1',
        },
      }),
    );
    await expect(
      approveBaseline(port, {
        ...plannerCmd,
        actor: { userId: 'planner-1', roles: ['PLANNER'] },
      }),
    ).rejects.toMatchObject({ code: 'SELF_APPROVAL' });
  });

  it('already approved', async () => {
    const { port } = portFor(surveyed({ baselineApproved: true }));
    await expect(
      approveBaseline(port, { ...plannerCmd, actor: { userId: 'p', roles: ['PLANNER'] } }),
    ).rejects.toMatchObject({ code: 'ALREADY_APPROVED' });
  });

  it('retired asset', async () => {
    const { port } = portFor(surveyed({ retired: true }));
    await expect(
      approveBaseline(port, { ...plannerCmd, actor: { userId: 'p', roles: ['PLANNER'] } }),
    ).rejects.toMatchObject({ code: 'ASSET_RETIRED' });
  });

  it('every refusal is a BaselineApprovalError with a Thai message', async () => {
    const { port } = portFor(surveyed({ survey: undefined }));
    await approveBaseline(port, {
      ...plannerCmd,
      actor: { userId: 'p', roles: ['PLANNER'] },
    }).catch((e: unknown) => {
      expect(e).toBeInstanceOf(BaselineApprovalError);
      expect((e as Error).message).toMatch(/[฀-๿]/);
    });
    expect.assertions(2);
  });
});
