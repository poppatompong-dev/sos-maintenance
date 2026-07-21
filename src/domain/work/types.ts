/**
 * Domain-local copies of the operational enums. The domain layer stays free of
 * Prisma imports (ADR 0001) — the persistence enums mirror these string values.
 */
export type WorkOrderStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'CLOSED'
  | 'REJECTED'
  | 'REOPENED'
  | 'CANCELLED';

export type AppRole = 'SYSTEM_ADMIN' | 'PLANNER' | 'TECHNICIAN' | 'EXECUTIVE';

export type MaintenanceKind =
  | 'INITIAL_SURVEY'
  | 'WEEKLY_CENTER'
  | 'MONTHLY_FIELD'
  | 'SEMIANNUAL_DEEP'
  | 'CORRECTIVE';

export const RECURRING_PM_KINDS: readonly MaintenanceKind[] = [
  'WEEKLY_CENTER',
  'MONTHLY_FIELD',
  'SEMIANNUAL_DEEP',
];
