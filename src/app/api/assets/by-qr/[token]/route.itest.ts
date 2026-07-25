import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { GET } from './route';

/**
 * Integration test for GET /api/assets/by-qr/:token — resolves a scanned QR
 * payload to the asset's business code (doc 08 §"สแกน QR เพื่อเปิด asset").
 */
const prisma = new PrismaClient();
const suffix = randomUUID().slice(0, 8);

let assetTypeId: string;
let locationId: string;
let assetId: string;
const ASSET_CODE = `EPQR_${suffix}`;
const QR_TOKEN = `qr_test_${suffix}`;

beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});

beforeAll(async () => {
  const assetType = await prisma.assetType.create({ data: { key: `SOS_QR_${suffix}`, name: 'qr' } });
  assetTypeId = assetType.id;
  const location = await prisma.location.create({ data: { code: `LOCQR_${suffix}`, name: 'qr', longitude: 100.1, latitude: 15.7 } });
  locationId = location.id;
  const asset = await prisma.asset.create({
    data: { code: ASSET_CODE, name: 'จุดทดสอบ QR', assetTypeId, locationId, longitude: 100.1, latitude: 15.7, qrToken: QR_TOKEN, lifecycle: 'ACTIVE' },
  });
  assetId = asset.id;
});

afterAll(async () => {
  await prisma.asset.deleteMany({ where: { id: assetId } });
  await prisma.location.deleteMany({ where: { id: locationId } });
  await prisma.assetType.deleteMany({ where: { id: assetTypeId } });
  await prisma.$disconnect();
});

function get(token: string, roles?: string): Request {
  const headers: Record<string, string> = {};
  if (roles) headers['x-dev-roles'] = roles;
  return new Request(`http://local/api/assets/by-qr/${token}`, { headers });
}

describe('GET /api/assets/by-qr/:token', () => {
  it('401 without a session', async () => {
    const res = await GET(get(QR_TOKEN), { params: Promise.resolve({ token: QR_TOKEN }) });
    expect(res.status).toBe(401);
  });

  it('404 for an unrecognized QR token', async () => {
    const unknown = `qr_unknown_${suffix}`;
    const res = await GET(get(unknown, 'TECHNICIAN'), { params: Promise.resolve({ token: unknown }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('QR_NOT_RECOGNIZED');
  });

  it('resolves a known QR token to its asset code', async () => {
    const res = await GET(get(QR_TOKEN, 'TECHNICIAN'), { params: Promise.resolve({ token: QR_TOKEN }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(ASSET_CODE);
  });
});
