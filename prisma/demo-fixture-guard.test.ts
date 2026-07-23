// prisma/demo-fixture-guard.test.ts
import { describe, expect, it } from 'vitest';
import {
  evaluateDemoGuard,
  REQUIRED_CONFIRM,
  REQUIRED_DB_NAME,
  type DemoGuardEnv,
} from './demo-fixture-guard';

const LOCAL_URL = 'postgresql://sos:sos@localhost:5432/sos?schema=public';

/** A fully valid local-demo environment; individual tests override one key. */
function baseEnv(overrides: Partial<DemoGuardEnv> = {}): DemoGuardEnv {
  return {
    LOCAL_DEMO_CONFIRM: REQUIRED_CONFIRM,
    NODE_ENV: 'development',
    DATABASE_URL: LOCAL_URL,
    ...overrides,
  };
}

describe('evaluateDemoGuard', () => {
  it('accepts a confirmed local sos database', () => {
    const result = evaluateDemoGuard(baseEnv());
    expect(result.ok).toBe(true);
  });

  it('rejects a missing confirmation variable', () => {
    const result = evaluateDemoGuard(baseEnv({ LOCAL_DEMO_CONFIRM: undefined }));
    expect(result.ok).toBe(false);
  });

  it('rejects a wrong confirmation value', () => {
    const result = evaluateDemoGuard(baseEnv({ LOCAL_DEMO_CONFIRM: 'yes' }));
    expect(result.ok).toBe(false);
  });

  it('rejects NODE_ENV=production', () => {
    const result = evaluateDemoGuard(baseEnv({ NODE_ENV: 'production' }));
    expect(result.ok).toBe(false);
  });

  it('rejects NODE_ENV=PRODUCTION case-insensitively', () => {
    const result = evaluateDemoGuard(baseEnv({ NODE_ENV: 'PRODUCTION' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing DATABASE_URL', () => {
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: undefined }));
    expect(result.ok).toBe(false);
  });

  it('rejects an unparseable DATABASE_URL', () => {
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: 'not a url' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a non-postgres protocol', () => {
    const result = evaluateDemoGuard(
      baseEnv({ DATABASE_URL: 'mysql://sos:sos@localhost:5432/sos' }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a remote host', () => {
    const result = evaluateDemoGuard(
      baseEnv({ DATABASE_URL: 'postgresql://u:p@db.neon.tech:5432/sos' }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a non-sos database name', () => {
    const result = evaluateDemoGuard(
      baseEnv({ DATABASE_URL: 'postgresql://sos:sos@localhost:5432/prod' }),
    );
    expect(result.ok).toBe(false);
  });

  it.each([
    'postgresql://sos:sos@localhost:5432/sos',
    'postgres://sos:sos@127.0.0.1:5432/sos',
    'postgresql://sos:sos@[::1]:5432/sos',
  ])('accepts loopback host form %s', (url) => {
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: url }));
    expect(result.ok).toBe(true);
  });

  it('never leaks the connection string in a rejection reason', () => {
    const secret = 'postgresql://sos:supersecret@db.neon.tech:5432/prod';
    const result = evaluateDemoGuard(baseEnv({ DATABASE_URL: secret }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).not.toContain('supersecret');
      expect(result.reason).not.toContain('db.neon.tech');
      expect(result.reason).not.toContain(secret);
    }
  });

  it('exposes the required constants used by callers and docs', () => {
    expect(REQUIRED_CONFIRM).toBe('SOS_LOCAL_DEMO');
    expect(REQUIRED_DB_NAME).toBe('sos');
  });
});
