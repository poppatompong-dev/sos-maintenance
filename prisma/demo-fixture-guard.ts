// prisma/demo-fixture-guard.ts
//
// Pure, IO-free environment validation for the LOCAL demo fixture. This module
// imports nothing from Prisma and must be safe to unit-test in the DB-free
// `pnpm test` run. It is the fail-closed gate that runs BEFORE any database
// client is constructed. It never returns or logs the connection string.

/** The subset of environment variables the guard inspects. */
export type DemoGuardEnv = Record<string, string | undefined> & {
  LOCAL_DEMO_CONFIRM?: string;
  NODE_ENV?: string;
  DATABASE_URL?: string;
};

export interface DemoGuardOk {
  readonly ok: true;
}

export interface DemoGuardRejected {
  readonly ok: false;
  /** Human-safe reason. MUST NOT contain the connection string. */
  readonly reason: string;
}

export type DemoGuardResult = DemoGuardOk | DemoGuardRejected;

/** Exact confirmation value the operator must set to run the demo seed. */
export const REQUIRED_CONFIRM = 'SOS_LOCAL_DEMO';

/** Only this database name is accepted — matches the dev Docker Compose service. */
export const REQUIRED_DB_NAME = 'sos';

/** Accepted Postgres URL schemes. */
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

/**
 * Accepted loopback hosts. WHATWG `URL.hostname` returns IPv6 literals wrapped
 * in brackets (`[::1]`); we also accept the bracketless `::1` after stripping.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function reject(reason: string): DemoGuardRejected {
  return { ok: false, reason };
}

/**
 * Validate that the current environment is an explicitly confirmed, non-production,
 * local `sos` Postgres database. Returns `{ ok: true }` only when EVERY check
 * passes. Reasons explain safe recovery and never echo the connection string.
 */
export function evaluateDemoGuard(env: DemoGuardEnv): DemoGuardResult {
  // 1. Explicit operator confirmation.
  if (env.LOCAL_DEMO_CONFIRM !== REQUIRED_CONFIRM) {
    return reject(
      `Refusing to run: set LOCAL_DEMO_CONFIRM=${REQUIRED_CONFIRM} to confirm a LOCAL demo seed.`,
    );
  }

  // 2. Never in production (case-insensitive: `production`, `PRODUCTION`, …).
  if ((env.NODE_ENV ?? '').toLowerCase() === 'production') {
    return reject('Refusing to run: NODE_ENV=production is not allowed for the demo seed.');
  }

  // 3. DATABASE_URL present and parseable.
  const raw = env.DATABASE_URL;
  if (!raw) {
    return reject('Refusing to run: DATABASE_URL is not set.');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return reject('Refusing to run: DATABASE_URL is not a parseable URL.');
  }

  // 3b. Postgres scheme only.
  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    return reject('Refusing to run: DATABASE_URL must use postgres: or postgresql:.');
  }

  // 4. Loopback host only. `hostname` omits the port; accept bracketed + bare ::1.
  const host = url.hostname;
  const bareHost = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (!LOOPBACK_HOSTS.has(host) && !LOOPBACK_HOSTS.has(bareHost)) {
    return reject(
      'Refusing to run: DATABASE_URL host must be localhost, 127.0.0.1, or ::1 (local only).',
    );
  }

  // 5. Database name must be exactly `sos`.
  const dbName = url.pathname.replace(/^\//, '');
  if (dbName !== REQUIRED_DB_NAME) {
    return reject(
      `Refusing to run: DATABASE_URL database name must be "${REQUIRED_DB_NAME}".`,
    );
  }

  return { ok: true };
}
