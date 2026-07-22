import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createPrismaInspectionPort } from './prisma-inspection-port';
import { submitInspection } from '../services/submit-inspection';
import type { MutationEnvelope } from '@/domain/sync/envelope';
import type { InspectionPayload } from '../services/submit-inspection';

/**
 * Integration test for the Prisma adapter — runs the REAL submit-inspection
 * service end-to-end against Postgres. Named `*.itest.ts` so it is excluded from
 * the unit `pnpm test` run and executed by `pnpm test:integration` (CI integration
 * job) where a live DATABASE_URL is provided.
 *
 * Self-contained: it provisions its own asset graph with unique codes and tears
 * it down afterwards, so it neither depends on nor pollutes the 27-pole seed.
 */

const prisma = new PrismaClient();
const port = createPrismaInspectionPort(prisma);

const suffix = randomUUID().slice(0, 8);
const ASSET_LAT = 15.7;
const ASSET_LNG = 100.12;

let assetTypeId: string;
let locationId: string;
let assetId: string;
let templateId: string;
let versionId: string;
let workOrderId: string;

beforeAll(async () => {
  const assetType = await prisma.assetType.create({
    data: { key: `SOS_POLE_TEST_${suffix}`, name: 'ทดสอบ' },
  });
  assetTypeId = assetType.id;

  const location = await prisma.location.create({
    data: { code: `LOCTEST_${suffix}`, name: 'จุดทดสอบ', longitude: ASSET_LNG, latitude: ASSET_LAT },
  });
  locationId = location.id;

  const asset = await prisma.asset.create({
    data: {
      code: `EPTEST_${suffix}`,
      name: 'เสาทดสอบ',
      assetTypeId,
      locationId,
      longitude: ASSET_LNG,
      latitude: ASSET_LAT,
      qrToken: `qr_test_${suffix}`,
      lifecycle: 'ACTIVE',
      baselineApproved: true,
      currentReadiness: 'UNKNOWN',
      components: {
        create: [
          { key: 'sos_button', name: 'ปุ่ม SOS', criticality: 'CRITICAL' },
          { key: 'network_voip', name: 'เครือข่าย/VoIP', criticality: 'CRITICAL' },
        ],
      },
    },
  });
  assetId = asset.id;

  const template = await prisma.checklistTemplate.create({
    data: { key: `TPL_TEST_${suffix}`, name: 'เช็คลิสต์ทดสอบ', kind: 'MONTHLY_FIELD' },
  });
  templateId = template.id;

  const version = await prisma.checklistTemplateVersion.create({
    data: {
      templateId,
      version: 1,
      publishedAt: new Date(),
      items: {
        create: [
          { order: 1, code: 'it_sos', label: 'ทดสอบปุ่ม SOS', kind: 'BOOLEAN_PASS_FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
          { order: 2, code: 'it_note', label: 'หมายเหตุ', kind: 'TEXT', criticality: 'NON_CRITICAL' },
        ],
      },
    },
  });
  versionId = version.id;

  const wo = await prisma.workOrder.create({
    data: {
      code: `WO-TEST-${suffix}`,
      kind: 'MONTHLY_FIELD',
      assetId,
      checklistVersionId: versionId,
      status: 'IN_PROGRESS',
    },
  });
  workOrderId = wo.id;
});

afterAll(async () => {
  // FK-safe teardown (children first).
  await prisma.checklistResponse.deleteMany({ where: { workOrderId } });
  await prisma.readinessSnapshot.deleteMany({ where: { assetId } });
  await prisma.fault.deleteMany({ where: { assetId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.assetComponent.deleteMany({ where: { assetId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function buildEnvelope(): MutationEnvelope<InspectionPayload> {
  return {
    mutationId: randomUUID(),
    deviceId: `dev_${suffix}`,
    entity: 'checklist_response',
    action: 'create',
    baseVersion: null,
    clientOccurredAt: new Date().toISOString(),
    payloadChecksum: 'test-checksum',
    payload: {
      workOrderId,
      responses: [
        { itemCode: 'it_sos', label: 'ทดสอบปุ่ม SOS', result: 'FAIL', criticality: 'CRITICAL', criticalFunctionKey: 'sos_button' },
        { itemCode: 'it_note', label: 'หมายเหตุ', result: 'NA', criticality: 'NON_CRITICAL' },
      ],
      gps: { lat: ASSET_LAT, lng: ASSET_LNG },
    },
  };
}

describe('Prisma InspectionPort (integration)', () => {
  it('persists a failed critical inspection: DOWN + fault + snapshot', async () => {
    const envelope = buildEnvelope();
    const result = await submitInspection(port, {
      envelope,
      actor: { userId: `u_${suffix}`, roles: ['TECHNICIAN'] },
      now: new Date(),
    });

    expect(result.idempotentReplay).toBe(false);
    expect(result.readiness?.status).toBe('DOWN');
    expect(result.faults).toHaveLength(1);

    const responses = await prisma.checklistResponse.count({ where: { workOrderId } });
    const faults = await prisma.fault.count({ where: { assetId } });
    const snapshots = await prisma.readinessSnapshot.count({ where: { assetId } });
    const asset = await prisma.asset.findUniqueOrThrow({ where: { id: assetId } });

    expect(responses).toBe(2);
    expect(faults).toBe(1);
    expect(snapshots).toBe(1);
    expect(asset.currentReadiness).toBe('DOWN');
    expect(asset.version).toBe(1);
  });

  it('is idempotent: replaying the same mutation writes nothing new', async () => {
    const envelope = buildEnvelope();
    const first = await submitInspection(port, {
      envelope,
      actor: { userId: `u_${suffix}`, roles: ['TECHNICIAN'] },
      now: new Date(),
    });
    expect(first.idempotentReplay).toBe(false);

    const before = await prisma.checklistResponse.count({ where: { workOrderId } });

    const replay = await submitInspection(port, {
      envelope,
      actor: { userId: `u_${suffix}`, roles: ['TECHNICIAN'] },
      now: new Date(),
    });
    expect(replay.idempotentReplay).toBe(true);

    const after = await prisma.checklistResponse.count({ where: { workOrderId } });
    expect(after).toBe(before);
  });
});
