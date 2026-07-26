import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';

/**
 * Integration test: baseline approval over the real API against Postgres
 * (ASSET-06; UAT cases 1 and 11). Covers the refusals that matter — no
 * survey, survey not yet accepted, self-approval, double approval — and
 * proves the happy path writes the approval fields AND an immutable
 * BASELINE_APPROVED readiness snapshot in the same act.
 */

const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let assetTypeId: string;
let locationId: string;
let assetId: string;
let surveyWorkOrderId: string;
let technicianUserId: string;
let plannerUserId: string;
const CODE = `EPBL_${suffix}`;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const assetType = await prisma.assetType.create({
    data: { key: `SOS_BL_${suffix}`, name: 'bl' },
  });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({
    data: { code: `LOCBL_${suffix}`, name: 'bl', longitude: 100.1, latitude: 15.7 },
  });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: {
      code: CODE,
      name: 'เสาทดสอบอนุมัติ',
      assetTypeId,
      locationId,
      longitude: 100.1,
      latitude: 15.7,
      qrToken: `qr_bl_${suffix}`,
      lifecycle: 'ACTIVE',
      baselineApproved: false,
      currentReadiness: 'UNKNOWN',
    },
  });
  assetId = asset.id;

  const technician = await prisma.user.create({
    data: { username: `tech_bl_${suffix}`, displayName: 'ช่างสำรวจ', roles: ['TECHNICIAN'] },
  });
  technicianUserId = technician.id;
  const planner = await prisma.user.create({
    data: { username: `plan_bl_${suffix}`, displayName: 'ผู้วางแผนทดสอบ', roles: ['PLANNER'] },
  });
  plannerUserId = planner.id;
});

afterAll(async () => {
  await prisma.readinessSnapshot.deleteMany({ where: { assetId } });
  await prisma.workLog.deleteMany({ where: { workOrderId: surveyWorkOrderId } });
  await prisma.workOrder.deleteMany({ where: { assetId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.user.deleteMany({ where: { id: { in: [technicianUserId, plannerUserId] } } });
  await prisma.$disconnect();
});

function post(roles: string, userId: string): Promise<Response> {
  return POST(
    new Request(`http://local/api/assets/${CODE}/baseline-approval`, {
      method: 'POST',
      headers: { 'x-dev-roles': roles, 'x-dev-user': userId },
    }),
    { params: Promise.resolve({ code: CODE }) },
  );
}

describe('POST /api/assets/:code/baseline-approval', () => {
  it('401 without a session', async () => {
    const res = await POST(
      new Request(`http://local/api/assets/${CODE}/baseline-approval`, { method: 'POST' }),
      { params: Promise.resolve({ code: CODE }) },
    );
    expect(res.status).toBe(401);
  });

  it('403 for a technician (no survey:approve)', async () => {
    const res = await post('TECHNICIAN', technicianUserId);
    expect(res.status).toBe(403);
  });

  it('403 for an executive (read-only)', async () => {
    const res = await post('EXECUTIVE', randomUUID());
    expect(res.status).toBe(403);
  });

  it('404 for an unknown asset', async () => {
    const res = await POST(
      new Request('http://local/api/assets/EP_NOPE/baseline-approval', {
        method: 'POST',
        headers: { 'x-dev-roles': 'PLANNER', 'x-dev-user': plannerUserId },
      }),
      { params: Promise.resolve({ code: 'EP_NOPE' }) },
    );
    expect(res.status).toBe(404);
  });

  it('409 SURVEY_MISSING before any initial survey exists', async () => {
    const res = await post('PLANNER', plannerUserId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('SURVEY_MISSING');
  });

  it('409 SURVEY_NOT_ACCEPTED while the survey is only SUBMITTED', async () => {
    const wo = await prisma.workOrder.create({
      data: {
        code: `WO-BL-${suffix}`,
        kind: 'INITIAL_SURVEY',
        assetId,
        status: 'SUBMITTED',
      },
    });
    surveyWorkOrderId = wo.id;
    await prisma.workLog.create({
      data: {
        workOrderId: wo.id,
        actorId: technicianUserId,
        fromStatus: 'IN_PROGRESS',
        toStatus: 'SUBMITTED',
      },
    });

    const res = await post('PLANNER', plannerUserId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('SURVEY_NOT_ACCEPTED');

    // The asset must be untouched by a refused attempt.
    const a = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { baselineApproved: true },
    });
    expect(a?.baselineApproved).toBe(false);
  });

  it('409 SELF_APPROVAL when the approver submitted the survey', async () => {
    await prisma.workOrder.update({
      where: { id: surveyWorkOrderId },
      data: { status: 'CLOSED' },
    });
    // The planner is also, in this scenario, the recorded submitter.
    await prisma.workLog.updateMany({
      where: { workOrderId: surveyWorkOrderId, toStatus: 'SUBMITTED' },
      data: { actorId: plannerUserId },
    });

    const res = await post('PLANNER', plannerUserId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('SELF_APPROVAL');
  });

  it('approves once the survey is accepted, and writes the snapshot', async () => {
    await prisma.workLog.updateMany({
      where: { workOrderId: surveyWorkOrderId, toStatus: 'SUBMITTED' },
      data: { actorId: technicianUserId },
    });

    const res = await post('PLANNER', plannerUserId);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(CODE);
    expect(body.approverUserId).toBe(plannerUserId);
    expect(body.surveyWorkOrderId).toBe(surveyWorkOrderId);

    const a = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        baselineApproved: true,
        baselineApprovedAt: true,
        baselineApproverId: true,
        currentReadiness: true,
      },
    });
    expect(a?.baselineApproved).toBe(true);
    expect(a?.baselineApprovedAt).toBeInstanceOf(Date);
    expect(a?.baselineApproverId).toBe(plannerUserId);

    const snaps = await prisma.readinessSnapshot.findMany({
      where: { assetId, trigger: 'BASELINE_APPROVED' },
    });
    expect(snaps).toHaveLength(1);
    // The stored status is the *computed* one, not an assumed READY: this
    // asset has no critical components and no evidence, so it stays UNKNOWN.
    expect(snaps[0].status).toBe(a?.currentReadiness);
    expect(snaps[0].status).toBe('UNKNOWN');
    // ...but no longer for the "no approved baseline" reason.
    const reasons = snaps[0].reasons as { code: string }[];
    expect(reasons.map((r) => r.code)).not.toContain('NO_APPROVED_BASELINE');
  });

  it('409 ALREADY_APPROVED on a second attempt', async () => {
    const res = await post('PLANNER', plannerUserId);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('ALREADY_APPROVED');

    // Still exactly one snapshot — no double write.
    const snaps = await prisma.readinessSnapshot.findMany({
      where: { assetId, trigger: 'BASELINE_APPROVED' },
    });
    expect(snaps).toHaveLength(1);
  });
});
