import type { AppRole } from '@/domain/work/types';
import { can, ForbiddenError, type Permission } from '@/domain/authz/policy';

/**
 * Server-side session + authorization guard (Sprint 5).
 *
 * The RBAC matrix already lives in the pure domain (`domain/authz/policy`). This
 * module is the thin, PLUGGABLE bridge between an HTTP request and that matrix:
 * resolve who the caller is, then enforce a permission on the server.
 *
 * `getSession` is deliberately provider-agnostic so the Keycloak-vs-free-OIDC
 * decision stays open. It is SAFE BY DEFAULT: with no provider wired it denies
 * (returns null). A dev-only bypass reads roles from a request header and is
 * active ONLY when `AUTH_DEV_BYPASS=true` — never enable it in production.
 */
export interface AppSession {
  userId: string;
  roles: AppRole[];
}

const VALID_ROLES: readonly string[] = [
  'SYSTEM_ADMIN',
  'PLANNER',
  'TECHNICIAN',
  'EXECUTIVE',
];

function parseRoles(raw: string | null): AppRole[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((r): r is AppRole => VALID_ROLES.includes(r));
}

/**
 * Resolve the current session from a request, or null when unauthenticated.
 * TODO(Sprint 5 decision): implement the real OIDC path (Keycloak or the chosen
 * free provider) here — validate the token/cookie and map subject → roles.
 */
export async function getSession(req: Request): Promise<AppSession | null> {
  if (process.env.AUTH_DEV_BYPASS === 'true') {
    const roles = parseRoles(req.headers.get('x-dev-roles'));
    if (roles.length === 0) return null;
    return { userId: req.headers.get('x-dev-user') ?? 'dev-user', roles };
  }
  // No real provider wired yet → deny (never silently allow).
  return null;
}

/** Thrown when there is no authenticated session at all (→ HTTP 401). */
export class UnauthenticatedError extends Error {
  constructor() {
    super('ต้องเข้าสู่ระบบก่อนดำเนินการ');
    this.name = 'UnauthenticatedError';
  }
}

/**
 * Enforce a permission for the current session. Throws `UnauthenticatedError`
 * (401) when there is no session, `ForbiddenError` (403) when the session lacks
 * the permission. Returns the session so handlers can use `userId`/`roles`.
 */
export function requirePermission(
  session: AppSession | null,
  permission: Permission,
): AppSession {
  if (!session) throw new UnauthenticatedError();
  if (!can(session.roles, permission)) throw new ForbiddenError(permission);
  return session;
}
