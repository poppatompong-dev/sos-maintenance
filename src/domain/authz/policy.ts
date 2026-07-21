import type { AppRole } from '../work/types';

/**
 * Central RBAC policy (doc 08). Authorization is enforced on the SERVER for every
 * endpoint and object; this pure matrix is the single definition of "which role
 * may do what". Object-level rules (ownership, separation of duties) live with
 * the aggregate — e.g. the work-order state machine — and compose on top.
 */
export const PERMISSIONS = [
  'asset:read',
  'asset:write',
  'asset:retire',
  'survey:submit',
  'survey:approve',
  'schedule:create',
  'schedule:approve',
  'schedule:publish',
  'workorder:assign',
  'workorder:start',
  'workorder:submit',
  'workorder:accept',
  'workorder:reject',
  'workorder:reopen',
  'workorder:cancel',
  'repair:submit',
  'fault:read',
  'report:read',
  'report:export',
  'import:run',
  'audit:read',
  'admin:users',
  'admin:system',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PLANNER_PERMISSIONS: Permission[] = [
  'asset:read',
  'asset:write',
  'asset:retire',
  'survey:approve',
  'schedule:create',
  'schedule:approve',
  'schedule:publish',
  'workorder:assign',
  'workorder:accept',
  'workorder:reject',
  'workorder:reopen',
  'workorder:cancel',
  'fault:read',
  'report:read',
  'report:export',
  'import:run',
  'audit:read',
];

const TECHNICIAN_PERMISSIONS: Permission[] = [
  'asset:read',
  'survey:submit',
  'workorder:start',
  'workorder:submit',
  'repair:submit',
  'fault:read',
];

const EXECUTIVE_PERMISSIONS: Permission[] = [
  'asset:read',
  'fault:read',
  'report:read',
  'report:export',
  'audit:read',
];

// System Admin manages the system and can also perform Planner operations
// (override), plus admin-only capabilities.
const ADMIN_PERMISSIONS: Permission[] = [
  ...PLANNER_PERMISSIONS,
  'admin:users',
  'admin:system',
];

export const ROLE_PERMISSIONS: Record<AppRole, ReadonlySet<Permission>> = {
  SYSTEM_ADMIN: new Set(ADMIN_PERMISSIONS),
  PLANNER: new Set(PLANNER_PERMISSIONS),
  TECHNICIAN: new Set(TECHNICIAN_PERMISSIONS),
  EXECUTIVE: new Set(EXECUTIVE_PERMISSIONS),
};

/** True when any of the user's roles grants the permission. */
export function can(roles: readonly AppRole[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r]?.has(permission));
}

/** Throwing guard for server handlers. */
export function assertCan(
  roles: readonly AppRole[],
  permission: Permission,
): void {
  if (!can(roles, permission)) {
    throw new ForbiddenError(permission);
  }
}

export class ForbiddenError extends Error {
  readonly permission: Permission;
  constructor(permission: Permission) {
    super(`ไม่มีสิทธิ์ดำเนินการ (${permission})`);
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}
