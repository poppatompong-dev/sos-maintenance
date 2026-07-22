import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as getAssets } from './assets/route';
import { GET as getAssetDetail } from './assets/[code]/route';
import { GET as getWorkOrders } from './work-orders/route';
import { GET as getFaults } from './faults/route';

/**
 * Integration tests for the read APIs against the SEEDED database (27 poles, no
 * faults/work-orders yet). Runs under `pnpm test:integration`. Read-only — makes
 * no writes, so it needs no fixture teardown.
 */

const original = process.env.AUTH_DEV_BYPASS;
beforeAll(() => {
  process.env.AUTH_DEV_BYPASS = 'true';
});
afterAll(() => {
  if (original === undefined) delete process.env.AUTH_DEV_BYPASS;
  else process.env.AUTH_DEV_BYPASS = original;
});

function get(url: string, roles = 'PLANNER'): Request {
  return new Request(url, { headers: { 'x-dev-roles': roles } });
}

describe('GET /api/assets', () => {
  it('401 without a session', async () => {
    const res = await getAssets(new Request('http://local/api/assets'));
    expect(res.status).toBe(401);
  });

  it('returns the 27 seeded poles for asset:read', async () => {
    const res = await getAssets(get('http://local/api/assets', 'EXECUTIVE'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(27);
    expect(body.assets[0].code).toBe('EP01');
    expect(body.assets.every((a: { status: string }) => a.status === 'UNKNOWN')).toBe(true);
  });
});

describe('GET /api/assets/:code', () => {
  it('returns detail with components for EP01', async () => {
    const res = await getAssetDetail(get('http://local/api/assets/EP01'), {
      params: Promise.resolve({ code: 'EP01' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('EP01');
    expect(body.components.length).toBeGreaterThan(0);
    expect(body.latestReadiness).toBeNull();
    expect(body.openFaults).toEqual([]);
    expect(body.activeWorkOrders).toEqual([]);
  });

  it('404 for an unknown code', async () => {
    const res = await getAssetDetail(get('http://local/api/assets/NOPE'), {
      params: Promise.resolve({ code: 'NOPE' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/work-orders', () => {
  it('returns an empty list on the fresh seed', async () => {
    const res = await getWorkOrders(get('http://local/api/work-orders'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.workOrders)).toBe(true);
    expect(body.count).toBe(0);
  });

  it('400 on an invalid status filter', async () => {
    const res = await getWorkOrders(get('http://local/api/work-orders?status=BOGUS'));
    expect(res.status).toBe(400);
  });
});

describe('GET /api/faults', () => {
  it('returns a list for a role with fault:read (PLANNER)', async () => {
    const res = await getFaults(get('http://local/api/faults', 'PLANNER'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.faults)).toBe(true);
  });
});
