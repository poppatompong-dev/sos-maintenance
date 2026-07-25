import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { POST } from './route';
import { GET as downloadGET } from './[id]/route';

/**
 * Integration test for the attachment upload/download endpoints (ADR 0005;
 * doc 05 §17). Uses a temp directory as the local storage volume so this
 * never touches the real `var/uploads` or leaves files behind.
 */
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let tmpDir: string;
let assetTypeId: string;
let locationId: string;
let assetId: string;
let faultId: string;
let workOrderId: string;
let repairActionId: string;
let versionId: string;
let templateId: string;
let checklistResponseId: string;

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 1, 2, 3, 4]);
const GARBAGE_BYTES = Buffer.from('not an image');

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'sos-attachments-itest-'));
  process.env.AUTH_DEV_BYPASS = 'true';
  process.env.STORAGE_LOCAL_DIR = tmpDir;
});

beforeAll(async () => {
  const assetType = await prisma.assetType.create({ data: { key: `SOS_AT_${suffix}`, name: 'at' } });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({ data: { code: `LOCAT_${suffix}`, name: 'at', longitude: 100.1, latitude: 15.7 } });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: { code: `EPAT_${suffix}`, name: 'at', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: `qr_at_${suffix}`, lifecycle: 'ACTIVE' },
  });
  assetId = asset.id;

  const fault = await prisma.fault.create({ data: { code: `FLT-AT-${suffix}`, assetId, severity: 'CRITICAL', status: 'IN_REPAIR', symptom: 'ทดสอบ' } });
  faultId = fault.id;
  const wo = await prisma.workOrder.create({ data: { code: `WO-AT-${suffix}`, kind: 'CORRECTIVE', assetId, faultId, status: 'IN_PROGRESS' } });
  workOrderId = wo.id;
  const repair = await prisma.repairAction.create({
    data: { faultId, workOrderId, cause: 'ทดสอบ', fixDescription: 'ทดสอบ', retestPassed: true },
  });
  repairActionId = repair.id;

  const version = await prisma.checklistTemplateVersion.create({
    data: {
      template: { create: { key: `TPL_AT_${suffix}`, name: 'tpl', kind: 'MONTHLY_FIELD' } },
      version: 1, status: 'PUBLISHED', publishedAt: new Date(), isLocked: true,
      items: { create: [{ order: 1, code: 'it_at', label: 'ทดสอบ', kind: 'BOOLEAN_PASS_FAIL', criticality: 'NON_CRITICAL' }] },
    },
  });
  versionId = version.id;
  templateId = version.templateId;
  const item = await prisma.checklistItem.findFirstOrThrow({ where: { versionId, code: 'it_at' } });
  const response = await prisma.checklistResponse.create({
    data: { workOrderId, itemId: item.id, checklistVersionId: versionId, result: 'PASS', observedAt: new Date() },
  });
  checklistResponseId = response.id;
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
  await prisma.attachment.deleteMany({ where: { entityId: { in: [repairActionId, checklistResponseId] } } });
  await prisma.checklistResponse.deleteMany({ where: { workOrderId } });
  await prisma.checklistItem.deleteMany({ where: { versionId } });
  await prisma.checklistTemplateVersion.deleteMany({ where: { id: versionId } });
  await prisma.checklistTemplate.deleteMany({ where: { id: templateId } });
  await prisma.repairAction.deleteMany({ where: { id: repairActionId } });
  await prisma.workOrder.deleteMany({ where: { id: workOrderId } });
  await prisma.fault.deleteMany({ where: { id: faultId } });
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function uploadRequest(fields: Record<string, string>, fileBytes: Buffer, roles?: string): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  form.set('file', new Blob([new Uint8Array(fileBytes)], { type: 'image/jpeg' }), 'photo.jpg');
  const headers: Record<string, string> = {};
  if (roles) headers['x-dev-roles'] = roles;
  return new Request('http://local/api/attachments', { method: 'POST', headers, body: form });
}

describe('POST /api/attachments', () => {
  it('401 without a session', async () => {
    const res = await POST(uploadRequest({ repairActionId }, JPEG_BYTES));
    expect(res.status).toBe(401);
  });

  it('403 when the role lacks workorder:submit and repair:submit', async () => {
    const res = await POST(uploadRequest({ repairActionId }, JPEG_BYTES, 'EXECUTIVE'));
    expect(res.status).toBe(403);
  });

  it('400 ATTACHMENT_PARENT_REQUIRED when neither parent id is given', async () => {
    const res = await POST(uploadRequest({}, JPEG_BYTES, 'TECHNICIAN'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('ATTACHMENT_PARENT_REQUIRED');
  });

  it('400 ATTACHMENT_INVALID for a non-image file', async () => {
    const res = await POST(uploadRequest({ repairActionId }, GARBAGE_BYTES, 'TECHNICIAN'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('ATTACHMENT_INVALID');
  });

  it('404 PARENT_NOT_FOUND for an unknown repairActionId', async () => {
    const res = await POST(uploadRequest({ repairActionId: randomUUID() }, JPEG_BYTES, 'TECHNICIAN'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('PARENT_NOT_FOUND');
  });

  it('201 uploads a repair-evidence photo, persists it, and it is downloadable', async () => {
    const res = await POST(uploadRequest({ repairActionId, phase: 'AFTER' }, JPEG_BYTES, 'TECHNICIAN'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entityType).toBe('REPAIR_ACTION');
    expect(body.mimeType).toBe('image/jpeg');
    expect(body.phase).toBe('AFTER');

    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: body.id } });
    expect(row.checksumSha256).toHaveLength(64);
    expect(row.repairActionId).toBe(repairActionId);

    const download = await downloadGET(
      new Request(`http://local/api/attachments/${body.id}`, { headers: { 'x-dev-roles': 'PLANNER' } }),
      { params: Promise.resolve({ id: body.id }) },
    );
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toBe('image/jpeg');
    const downloaded = Buffer.from(await download.arrayBuffer());
    expect(downloaded.equals(JPEG_BYTES)).toBe(true);
  });

  it('201 uploads a checklist-evidence photo against a real ChecklistResponse', async () => {
    const res = await POST(uploadRequest({ checklistResponseId }, JPEG_BYTES, 'TECHNICIAN'));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entityType).toBe('CHECKLIST_RESPONSE');

    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: body.id } });
    expect(row.checklistResponseId).toBe(checklistResponseId);
  });
});

describe('GET /api/attachments/:id', () => {
  it('401 without a session', async () => {
    const res = await downloadGET(new Request('http://local/api/attachments/nope'), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(401);
  });

  it('404 for an unknown id', async () => {
    const unknown = randomUUID();
    const res = await downloadGET(
      new Request(`http://local/api/attachments/${unknown}`, { headers: { 'x-dev-roles': 'PLANNER' } }),
      { params: Promise.resolve({ id: unknown }) },
    );
    expect(res.status).toBe(404);
  });
});
