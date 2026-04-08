import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getBudgetPressureSnapshot } from './systemDepthEngine';

const {
  mockGetTeamPayrollSnapshot,
  mockGetTeamFinanceSummary,
  mockGetBoardExpectations,
} = vi.hoisted(() => ({
  mockGetTeamPayrollSnapshot: vi.fn(),
  mockGetTeamFinanceSummary: vi.fn(),
  mockGetBoardExpectations: vi.fn(),
}));

vi.mock('../economy/payrollEngine', () => ({
  getTeamPayrollSnapshot: mockGetTeamPayrollSnapshot,
}));

vi.mock('../../db/queries', () => ({
  getTeamFinanceSummary: mockGetTeamFinanceSummary,
  insertFinanceLog: vi.fn(),
}));

vi.mock('../board/boardEngine', () => ({
  getBoardExpectations: mockGetBoardExpectations,
}));

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../complaint/complaintEngine', () => ({
  getActiveComplaints: vi.fn(),
}));

vi.mock('./releaseDepthEngine', () => ({
  evaluateCareerArcProgress: vi.fn(),
  getCareerArcEvents: vi.fn(),
  getInternationalExpectationSnapshot: vi.fn(),
  getRelationshipInfluenceSnapshot: vi.fn(),
}));

describe('getBudgetPressureSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enters watch pressure earlier when runway and failed talks tighten', async () => {
    mockGetTeamPayrollSnapshot.mockResolvedValue({
      currentBudget: 18000,
      playerSalaryTotal: 17000,
      staffSalaryTotal: 9000,
      effectiveStaffPayroll: 4500,
      salaryCap: 25000,
      totalPayroll: 21500,
      capRoom: 3500,
      overage: 0,
      luxuryTax: 0,
      pressureBand: 'safe',
    });
    mockGetTeamFinanceSummary.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      logs: [
        { type: 'expense', category: 'failed_negotiation', amount: 1800 },
        { type: 'expense', category: 'negotiation_contact', amount: 1200 },
      ],
    });
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 56 });

    const snapshot = await getBudgetPressureSnapshot('team-a', 1);

    expect(snapshot.pressureLevel).toBe('watch');
    expect(snapshot.failedNegotiations).toBe(1);
    expect(snapshot.runwayWeeks).toBeLessThan(10);
    expect(snapshot.boardPressureNote.length).toBeGreaterThan(0);
  });

  it('flags critical pressure when runway, board trust, and cap pressure all collapse', async () => {
    mockGetTeamPayrollSnapshot.mockResolvedValue({
      currentBudget: -5000,
      playerSalaryTotal: 24000,
      staffSalaryTotal: 16000,
      effectiveStaffPayroll: 8000,
      salaryCap: 25000,
      totalPayroll: 33000,
      capRoom: -8000,
      overage: 8000,
      luxuryTax: 1800,
      pressureBand: 'hard_stop',
    });
    mockGetTeamFinanceSummary.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      logs: [
        { type: 'expense', category: 'failed_negotiation', amount: 3000 },
        { type: 'expense', category: 'failed_negotiation', amount: 2800 },
        { type: 'expense', category: 'negotiation_contact', amount: 1900 },
      ],
    });
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 38 });

    const snapshot = await getBudgetPressureSnapshot('team-a', 1);

    expect(snapshot.pressureLevel).toBe('critical');
    expect(snapshot.pressureScore).toBeGreaterThanOrEqual(72);
    expect(snapshot.topDrivers.length).toBeGreaterThan(0);
    expect(snapshot.boardPressureNote.length).toBeGreaterThan(0);
  });
});
