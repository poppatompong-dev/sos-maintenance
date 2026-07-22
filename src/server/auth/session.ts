import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AppRole } from '@/domain/work/types';
import { can, ForbiddenError, type Permission } from '@/domain/authz/policy';

/**
 * Server-side actor + authorization guard.
 *
 * The RBAC matrix lives in the pure domain (`domain/authz/policy`). This module
 * bridges an HTTP request to it: resolve who the caller is, then enforce a
 * permission on the server.
 *
 * Auth resolution order:
 *   1. `AUTH_MODE=internal` → no-login internal operator. This is intentionally
 *      explicit because it exposes the API to whoever can reach the deployment.
 *   2. `AUTH_DEV_BYPASS=true` → DEV-ONLY roles from request headers.
 *   3. Otherwise → verify a Keycloak-issued bearer token.
 */
export interface AppSession {
  userId: string;
  roles: AppRole[];
  internal?: boolean;
}

/** Stable DB actor used by the explicit no-login internal deployment mode. */
export const INTERNAL_ACTOR_ID = '00000000-0000-0000-0000-000000000001';
export const INTERNAL_SESSION: AppSession = {
  userId: INTERNAL_ACTOR_ID,
  roles: ['SYSTEM_ADMIN', 'PLANNER', 'TECHNICIAN', 'EXECUTIVE'],
  internal: true,
};

const VALID_ROLES: readonly string[] = [
  'SYSTEM_ADMIN',
  'PLANNER',
  'TECHNICIAN',
  'EXECUTIVE',
];

const isRole = (x: unknown): x is AppRole =>
  typeof x === 'string' && VALID_ROLES.includes(x);

function rolesFrom(value: unknown): AppRole[] {
  return Array.isArray(value) ? value.filter(isRole) : [];
}

// ── Dev bypass ───────────────────────────────────────────────────────────────

function parseHeaderRoles(raw: string | null): AppRole[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(isRole);
}

// ── Keycloak OIDC ────────────────────────────────────────────────────────────

/**
 * PURE: map a *verified* Keycloak token payload to an AppSession, or null when it
 * carries no usable subject/roles. Keycloak exposes realm roles under
 * `realm_access.roles` and per-client roles under `resource_access[client].roles`;
 * we accept our four AppRoles from either. Unit-tested in isolation.
 */
export function sessionFromClaims(
  claims: JWTPayload,
  opts: { clientId?: string } = {},
): AppSession | null {
  const sub = typeof claims.sub === 'string' ? claims.sub : null;
  if (!sub) return null;

  const realm = (claims as { realm_access?: { roles?: unknown } }).realm_access;
  const resource = (claims as { resource_access?: Record<string, { roles?: unknown }> })
    .resource_access;
  const clientRoles = opts.clientId ? resource?.[opts.clientId]?.roles : undefined;

  const roles = Array.from(
    new Set([...rolesFrom(realm?.roles), ...rolesFrom(clientRoles)]),
  );
  if (roles.length === 0) return null;
  return { userId: sub, roles };
}

// Cache one JWKS resolver per issuer (createRemoteJWKSet caches keys internally).
let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksIssuer: string | null = null;

function getJwks(issuer: string) {
  if (!jwksCache || jwksIssuer !== issuer) {
    jwksCache = createRemoteJWKSet(
      new URL(`${issuer}/protocol/openid-connect/certs`),
    );
    jwksIssuer = issuer;
  }
  return jwksCache;
}

async function verifyBearer(req: Request): Promise<AppSession | null> {
  const issuer = process.env.KEYCLOAK_ISSUER;
  if (!issuer) return null;
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwks(issuer), { issuer });
    return sessionFromClaims(payload, { clientId: process.env.KEYCLOAK_CLIENT_ID });
  } catch {
    // Invalid signature / expired / wrong issuer → unauthenticated.
    return null;
  }
}

/** Resolve the current session from a request, or null when unauthenticated. */
export async function getSession(req: Request): Promise<AppSession | null> {
  if (process.env.AUTH_MODE === 'internal') {
    return INTERNAL_SESSION;
  }
  if (process.env.AUTH_DEV_BYPASS === 'true') {
    const roles = parseHeaderRoles(req.headers.get('x-dev-roles'));
    if (roles.length === 0) return null;
    return { userId: req.headers.get('x-dev-user') ?? 'dev-user', roles };
  }
  return verifyBearer(req);
}

// ── Guards ───────────────────────────────────────────────────────────────────

/** Thrown when there is no authenticated session at all (→ HTTP 401). */
export class UnauthenticatedError extends Error {
  constructor() {
    super('ต้องเข้าสู่ระบบก่อนดำเนินการ');
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Enforce a permission for the current session. Throws `UnauthenticatedError`
 * (401) when there is no session, `ForbiddenError` (403) when it lacks the
 * permission. Returns the session so handlers can use `userId`/`roles`.
 */
export function requirePermission(
  session: AppSession | null,
  permission: Permission,
): AppSession {
  if (!session) throw new UnauthenticatedError();
  if (!can(session.roles, permission)) throw new ForbiddenError(permission);
  return session;
}

/**
 * Enforce that the session holds AT LEAST ONE of the given permissions. Used
 * where more than one role legitimately reaches an action (e.g. a work order is
 * closed either by a Planner accepting or a Technician self-closing a passing PM).
 */
export function requireAnyPermission(
  session: AppSession | null,
  permissions: readonly Permission[],
): AppSession {
  if (!session) throw new UnauthenticatedError();
  if (!permissions.some((p) => can(session.roles, p))) {
    throw new ForbiddenError(permissions[0]);
  }
  return session;
}
