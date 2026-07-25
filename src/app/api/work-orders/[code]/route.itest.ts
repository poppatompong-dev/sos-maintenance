import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';

/**
 * Integration test for GET /api/work-orders/:code — single work-order detail,
 * including the fault + latest repair evidence a Planner needs before accepting
 * or rejecting a corrective work order.
 */
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let assetTypeId: string;
let locationId: string;
let assetId: string;
let plainWorkOrderId: string;
let correctiveWorkOrderId: string;
let faultId: string;
const PLAIN_CODE = `WO-DT-${suffix}`;
const CORRECTIVE_CODE = `WO-DTC-${suffix}`;
const FAULT_CODE = `FLT-DT-${suffix}`;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const assetType = await prisma.assetType.create({ data: { key: `SOS_DT_${suffix}`, name: 'dt' } });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({ data: { code: `LOCDT_${suffix}`, name: 'dt', longitude: 100.1, latitude: 15.7 } });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: { code: `EPDT_${suffix}`, name: 'จุดทดสอบ', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_dt_${suffix}`, lifecycle: 'ACTIVE' },
  });
  assetId = asset.id;

  const plain = await prisma.workOrder.create({ data: { code: PLAIN_CODE, kind: 'MONTHLY_FIELD', assetId, status: 'DRAFT' } });
  plainWorkOrderId = plain.id;

  const fault = await prisma.fault.create({
    data: { code: FAULT_CODE, assetId, severity: 'CRITICAL', status: 'RETEST', symptom: 'ปุ่ม SOS ไม่ทำงาน' },
  });
  faultId = fault.id;
  const corrective = await prisma.workOrder.create({
    data: { code: CORRECTIVE_CODE, kind: 'CORRECTIVE', assetId, status: 'SUBMITTED', faultId },
  });
  correctiveWorkOrderId = corrective.id;
  await prisma.repairAction.create({
    data: {
      faultId,
      workOrderId: correctiveWorkOrderId,
      cause: 'สายหลุด',
      fixDescription: 'เสียบสายใหม่ + ทดสอบ',
      retestPassed: true,
      retestNote: 'ทดสอบปุ่ม SOS ผ่าน',
    },
  });
});

afterAll(async () => {
  await prisma.repairAction.deleteMany({ where: { workOrderId: correctiveWorkOrderId } });
  await prisma.workOrder.deleteMany({ where: { id: { in: [plainWorkOrderId, correctiveWorkOrderId] } } });
  await prisma.fault.deleteMany({ where: { id: faultId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function get(code: string, roles?: string): Request {
  const headers: Record<string, string> = {};
  if (roles) headers['x-dev-roles'] = roles;
  return new Request(`http://local/api/work-orders/${code}`, { headers });
}

describe('GET /api/work-orders/:code', () => {
  it('401 without a session', async () => {
    const res = await GET(get(PLAIN_CODE), { params: Promise.resolve({ code: PLAIN_CODE }) });
    expect(res.status).toBe(401);
  });

  it('404 for an unknown code', async () => {
    const res = await GET(get(`WO-NOPE-${suffix}`, 'PLANNER'), { params: Promise.resolve({ code: `WO-NOPE-${suffix}` }) });
    expect(res.status).toBe(404);
  });

  it('returns detail with fault: null for a non-corrective work order', async () => {
    const res = await GET(get(PLAIN_CODE, 'PLANNER'), { params: Promise.resolve({ code: PLAIN_CODE }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(PLAIN_CODE);
    expect(body.assetCode).toBe(`EPDT_${suffix}`);
    expect(body.fault).toBeNull();
  });

  it('returns the fault and latest repair evidence for a corrective work order', async () => {
    const res = await GET(get(CORRECTIVE_CODE, 'PLANNER'), { params: Promise.resolve({ code: CORRECTIVE_CODE }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fault.code).toBe(FAULT_CODE);
    expect(body.fault.severity).toBe('CRITICAL');
    expect(body.fault.latestRepair.cause).toBe('สายหลุด');
    expect(body.fault.latestRepair.retestPassed).toBe(true);
  });
});
