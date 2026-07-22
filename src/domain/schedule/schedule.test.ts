import { describe, expect, it } from 'vitest';
import {
  allowedBatchNext,
  canBatchTransition,
  formatWorkOrderCode,
} from './index';

describe('schedule-batch transitions', () => {
  it('exposes the forward-only graph', () => {
    expect(allowedBatchNext('DRAFT')).toEqual(['APPROVED']);
    expect(allowedBatchNext('APPROVED')).toEqual(['PUBLISHED']);
    expect(allowedBatchNext('PUBLISHED')).toEqual([]);
  });

  it('allows valid edges', () => {
    expect(canBatchTransition('DRAFT', 'APPROVED').allowed).toBe(true);
    expect(canBatchTransition('APPROVED', 'PUBLISHED').allowed).toBe(true);
  });

  it('rejects invalid edges', () => {
    expect(canBatchTransition('DRAFT', 'PUBLISHED').allowed).toBe(false);
    expect(canBatchTransition('PUBLISHED', 'APPROVED').allowed).toBe(false);
    expect(canBatchTransition('APPROVED', 'DRAFT').allowed).toBe(false);
  });
});

describe('formatWorkOrderCode', () => {
  it('zero-pads the sequence to 4 digits', () => {
    expect(formatWorkOrderCode(2026, 7)).toBe('WO-2026-0007');
    expect(formatWorkOrderCode(2026, 1234)).toBe('WO-2026-1234');
  });
});
