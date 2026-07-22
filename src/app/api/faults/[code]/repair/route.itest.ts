import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';

/**
 * Integration test for POST /api/faults/:code/repair — repair + retest against a
 * real fault in Postgres, covering resolve, reopen, auth, and not-found.
 */
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let assetTypeId: string;
let locationId: string;
let assetId: string;
let workOrderId: string;
const FAULT_A = `FLT-A-${suffix}`;
const FAULT_B = `FLT-B-${suffix}`;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const at = await prisma.assetType.create({ data: { key: `SOS_RP_${suffix}`, name: 'rp' } });
  assetTypeId = at.id;
  const loc = await prisma.location.create({ data: { code: `LOCRP_${suffix}`, name: 'rp', longitude: 100.1, latitude: 15.7 } });
  locationId = loc.id;
  const asset = await prisma.asset.create({
    data: { code: `EPRP_${suffix}`, name: 'rp', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_rp_${suffix}`, lifecycle: 'ACTIVE' },
  });
  assetId = asset.id;
  const wo = await prisma.workOrder.create({ data: { code: `WO-RP-${suffix}`, kind: 'CORRECTIVE', assetId, status: 'IN_PROGRESS' } });
  workOrderId = wo.id;
  await prisma.fault.createMany({
    data: [
      { code: FAULT_A, assetId, severity: 'CRITICAL', status: 'IN_REPAIR', symptom: 'ปุ่ม SOS ไม่ทำงาน' },
      { code: FAULT_B, assetId, severity: 'CRITICAL', status: 'IN_REPAIR', symptom: 'ไมค์เสีย' },
    ],
  });
});

afterAll(async () => {
  await prisma.repairAction.deleteMany({ where: { workOrderId } });
  await prisma.fault.deleteMany({ where: { assetId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function post(code: string, body: unknown, roles = 'TECHNICIAN'): Promise<Response> {
  return POST(
    new Request(`http://local/api/faults/${code}/repair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-dev-roles': roles, 'x-dev-user': 'tech1' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ code }) },
  );
}

const validBody = (retestPassed: boolean) => ({
  workOrderId,
  cause: 'สายหลุด',
  fixDescription: 'เสียบสายใหม่ + ทดสอบ',
  retestPassed,
});

describe('POST /api/faults/:code/repair', () => {
  it('401 without a session', async () => {
    const res = await POST(
      new Request(`http://local/api/faults/${FAULT_A}/repair`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(validBody(true)),
      }),
      { params: Promise.resolve({ code: FAULT_A }) },
    );
    expect(res.status).toBe(401);
  });

  it('403 when the role lacks repair:submit (executive)', async () => {
    const res = await post(FAULT_A, validBody(true), 'EXECUTIVE');
    expect(res.status).toBe(403);
  });

  it('404 for an unknown fault', async () => {
    const res = await post(`FLT-NOPE-${suffix}`, validBody(true));
    expect(res.status).toBe(404);
  });

  it('resolves the fault on a passing retest', async () => {
    const res = await post(FAULT_A, validBody(true));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('RESOLVED');

    const fault = await prisma.fault.findUniqueOrThrow({ where: { code: FAULT_A } });
    expect(fault.status).toBe('RESOLVED');
    expect(fault.resolvedAt).not.toBeNull();
    const repairs = await prisma.repairAction.count({ where: { faultId: fault.id } });
    expect(repairs).toBe(1);
  });

  it('reopens the fault on a failing retest', async () => {
    const res = await post(FAULT_B, validBody(false));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('REOPENED');
    const fault = await prisma.fault.findUniqueOrThrow({ where: { code: FAULT_B } });
    expect(fault.status).toBe('REOPENED');
    expect(fault.resolvedAt).toBeNull();
  });
});
