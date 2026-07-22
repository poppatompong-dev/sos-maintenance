import { afterEach, describe, expect, it } from 'vitest';
import {
  getSession,
  requirePermission,
  UnauthenticatedError,
  type AppSession,
} from './session';
import { ForbiddenError } from '@/domain/authz/policy';

function reqWith(headers: Record<string, string>): Request {
  return new Request('http://local/api', { headers });
}

const original = process.env.AUTH_DEV_BYPASS;
afterEach(() => {
  if (original === undefined) delete process.env.AUTH_DEV_BYPASS;
  else process.env.AUTH_DEV_BYPASS = original;
});

describe('getSession', () => {
  it('denies (null) when no provider is wired', async () => {
    delete process.env.AUTH_DEV_BYPASS;
    expect(await getSession(reqWith({ 'x-dev-roles': 'SYSTEM_ADMIN' }))).toBeNull();
  });

  it('denies when bypass is on but no roles header', async () => {
    process.env.AUTH_DEV_BYPASS = 'true';
    expect(await getSession(reqWith({}))).toBeNull();
  });

  it('resolves roles from header only under dev bypass', async () => {
    process.env.AUTH_DEV_BYPASS = 'true';
    const s = await getSession(
      reqWith({ 'x-dev-roles': 'TECHNICIAN, PLANNER', 'x-dev-user': 'u1' }),
    );
    expect(s).toEqual({ userId: 'u1', roles: ['TECHNICIAN', 'PLANNER'] });
  });

  it('ignores unknown role tokens', async () => {
    process.env.AUTH_DEV_BYPASS = 'true';
    const s = await getSession(reqWith({ 'x-dev-roles': 'TECHNICIAN,ROOT' }));
    expect(s?.roles).toEqual(['TECHNICIAN']);
  });
});

describe('requirePermission', () => {
  const tech: AppSession = { userId: 'u', roles: ['TECHNICIAN'] };

  it('throws UnauthenticatedError when session is null', () => {
    expect(() => requirePermission(null, 'asset:read')).toThrow(UnauthenticatedError);
  });

  it('throws ForbiddenError when permission is missing', () => {
    expect(() => requirePermission(tech, 'admin:system')).toThrow(ForbiddenError);
  });

  it('returns the session when permission is granted', () => {
    expect(requirePermission(tech, 'workorder:submit')).toBe(tech);
  });
});
