import { describe, expect, it } from 'vitest';
import { assertCan, can, ForbiddenError } from './policy';

describe('RBAC policy', () => {
  it('executive is read/export only — never writes', () => {
    expect(can(['EXECUTIVE'], 'report:export')).toBe(true);
    expect(can(['EXECUTIVE'], 'asset:read')).toBe(true);
    expect(can(['EXECUTIVE'], 'asset:write')).toBe(false);
    expect(can(['EXECUTIVE'], 'workorder:accept')).toBe(false);
  });

  it('technician can do field work but not accept/assign', () => {
    expect(can(['TECHNICIAN'], 'workorder:submit')).toBe(true);
    expect(can(['TECHNICIAN'], 'repair:submit')).toBe(true);
    expect(can(['TECHNICIAN'], 'workorder:accept')).toBe(false);
    expect(can(['TECHNICIAN'], 'schedule:publish')).toBe(false);
  });

  it('planner plans, approves and accepts', () => {
    expect(can(['PLANNER'], 'schedule:approve')).toBe(true);
    expect(can(['PLANNER'], 'workorder:accept')).toBe(true);
    expect(can(['PLANNER'], 'survey:approve')).toBe(true);
    expect(can(['PLANNER'], 'admin:users')).toBe(false);
  });

  it('system admin has admin caps and planner override', () => {
    expect(can(['SYSTEM_ADMIN'], 'admin:system')).toBe(true);
    expect(can(['SYSTEM_ADMIN'], 'workorder:accept')).toBe(true);
  });

  it('multiple roles union their permissions', () => {
    expect(can(['EXECUTIVE', 'TECHNICIAN'], 'workorder:submit')).toBe(true);
  });

  it('assertCan throws ForbiddenError when denied', () => {
    expect(() => assertCan(['EXECUTIVE'], 'asset:write')).toThrow(ForbiddenError);
    expect(() => assertCan(['PLANNER'], 'asset:write')).not.toThrow();
  });
});
