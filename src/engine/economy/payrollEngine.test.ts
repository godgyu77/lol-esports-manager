import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockExecute = vi.fn();

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    select: (...args: unknown[]) => mockSelect(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
  }),
}));

import { calculateDynamicSalaryCap, getTeamPayrollSnapshot, getTeamSalaryCap } from './payrollEngine';

describe('payrollEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue(undefined);
  });

  it('keeps the dynamic salary cap above the previous baseline for high-budget teams', () => {
    expect(calculateDynamicSalaryCap(500000, 85, 'LCK')).toBeGreaterThan(30000);
  });

  it('raises the salary cap floor above current payroll so a new save does not start capped out', async () => {
    mockSelect
      .mockResolvedValueOnce([
        { budget: 240000, reputation: 78, salary_cap: 28000, region: 'LCK' },
      ])
      .mockResolvedValueOnce([{ total: 30000 }])
      .mockResolvedValueOnce([
        { role: 'head_coach', salary: 4000 },
        { role: 'coach', salary: 2500 },
      ]);

    const cap = await getTeamSalaryCap('lck_T1');

    expect(cap).toBeGreaterThan(35000);
    expect(mockExecute).toHaveBeenCalled();
  });

  it('returns a safe payroll snapshot with breathing room for the current roster', async () => {
    mockSelect
      .mockResolvedValueOnce([{ budget: 240000, region: 'LCK' }])
      .mockResolvedValueOnce([{ total: 30000 }])
      .mockResolvedValueOnce([
        { role: 'head_coach', salary: 4000 },
        { role: 'coach', salary: 2500 },
      ])
      .mockResolvedValueOnce([
        { budget: 240000, reputation: 78, salary_cap: 28000, region: 'LCK' },
      ])
      .mockResolvedValueOnce([{ total: 30000 }])
      .mockResolvedValueOnce([
        { role: 'head_coach', salary: 4000 },
        { role: 'coach', salary: 2500 },
      ]);

    const snapshot = await getTeamPayrollSnapshot('lck_T1');

    expect(snapshot.salaryCap).toBeGreaterThan(snapshot.totalPayroll);
    expect(snapshot.capRoom).toBeGreaterThanOrEqual(2500);
    expect(snapshot.pressureBand).toBe('safe');
  });
});
