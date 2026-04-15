import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPlayerById = vi.fn();
const mockGetActiveSeason = vi.fn();
const mockGetPlayersByTeamId = vi.fn();
const mockGetDatabase = vi.fn();
const mockRelationshipSnapshot = vi.fn();
const mockGetBudgetPressureSnapshot = vi.fn();
const mockGetTeamPayrollSnapshot = vi.fn();

vi.mock('../../db/queries', () => ({
  getPlayerById: (...args: unknown[]) => mockGetPlayerById(...args),
  getActiveSeason: (...args: unknown[]) => mockGetActiveSeason(...args),
  getPlayersByTeamId: (...args: unknown[]) => mockGetPlayersByTeamId(...args),
  createTransferOffer: vi.fn(),
  updateTransferOfferTerms: vi.fn(),
}));

vi.mock('../../db/database', () => ({
  getDatabase: () => mockGetDatabase(),
}));

vi.mock('../manager/releaseDepthEngine', () => ({
  getRelationshipInfluenceSnapshot: (...args: unknown[]) => mockRelationshipSnapshot(...args),
}));

vi.mock('../agent/agentEngine', () => ({ agentNegotiate: vi.fn() }));
vi.mock('../rules/leagueRulesEngine', () => ({ canSignForeignPlayer: vi.fn() }));
vi.mock('./payrollEngine', () => ({
  evaluatePayrollImpact: vi.fn().mockReturnValue({ pressureBand: 'safe' }),
  getTeamPayrollSnapshot: (...args: unknown[]) => mockGetTeamPayrollSnapshot(...args),
}));
vi.mock('./transferTransactions', () => ({
  acceptFreeAgentOffer: vi.fn(),
  acceptTransferOffer: vi.fn(),
  cancelTransferOffer: vi.fn(),
  getFreeAgents: vi.fn(),
  getPlayerForAgent: vi.fn(),
  getTeamTransferOffers: vi.fn(),
  processExpiredContracts: vi.fn(),
  rejectTransferOffer: vi.fn(),
}));
vi.mock('./transferAi', () => ({
  processAIFreeAgentSignings: vi.fn(),
  processAITransfers: vi.fn(),
}));
vi.mock('../manager/systemDepthEngine', () => ({
  recordNegotiationExpense: vi.fn(),
  getBudgetPressureSnapshot: (...args: unknown[]) => mockGetBudgetPressureSnapshot(...args),
}));

import { evaluateIncomingTransferOffer } from './transferEngine';

const player = {
  id: 'player_1',
  name: 'Star Mid',
  teamId: 'team_1',
  position: 'mid',
  age: 23,
  nationality: 'KR',
  stats: {
    mechanical: 90,
    gameSense: 88,
    teamwork: 80,
    consistency: 84,
    laning: 89,
    aggression: 78,
  },
  mental: {
    mental: 78,
    stamina: 82,
    morale: 70,
  },
  contract: {
    salary: 4000,
    contractEndSeason: 4,
  },
  championPool: [],
  potential: 92,
  peakAge: 24,
  popularity: 70,
  secondaryPosition: null,
  playstyle: 'aggressive',
  careerGames: 120,
  chemistry: {},
  formHistory: [],
  division: 'sub',
};

describe('evaluateIncomingTransferOffer relationship modifiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDatabase.mockResolvedValue({
      select: vi.fn().mockResolvedValue([]),
    });
    mockGetPlayerById.mockResolvedValue(player);
    mockGetActiveSeason.mockResolvedValue({ id: 3 });
    mockGetPlayersByTeamId.mockResolvedValue([player]);
    mockGetBudgetPressureSnapshot.mockResolvedValue({
      currentBudget: 180000,
      weeklyRecurringExpenses: 12000,
      monthlyRecurringExpenses: 48000,
      recentNegotiationCosts: 0,
      failedNegotiations: 0,
      playerSalaryTotal: 28000,
      staffSalaryTotal: 6000,
      effectiveStaffPayroll: 4800,
      salaryCap: 42000,
      totalPayroll: 32800,
      capRoom: 9200,
      luxuryTax: 0,
      runwayWeeks: 15,
      pressureBand: 'safe',
      boardSatisfaction: 70,
      boardRisk: 6,
      pressureScore: 18,
      pressureLevel: 'stable',
      boardPressureNote: '',
      topDrivers: [],
    });
    mockGetTeamPayrollSnapshot.mockResolvedValue({
      teamId: 'team_1',
      currentBudget: 180000,
      salaryCap: 42000,
      playerSalaryTotal: 28000,
      staffSalaryTotal: 6000,
      effectiveStaffPayroll: 4800,
      totalPayroll: 32800,
      capRoom: 9200,
      overage: 0,
      luxuryTax: 0,
      pressureBand: 'safe',
    });
    mockRelationshipSnapshot.mockResolvedValue({
      teamId: 'team_1',
      strongPairs: [],
      riskPairs: [],
      mentorLinks: [],
      staffTrust: 60,
      moraleImpact: 0,
      transferImpact: 0,
      summary: '',
    });
  });

  it('demands a steeper counter when the player anchors strong bonds', async () => {
    mockRelationshipSnapshot.mockResolvedValueOnce({
      teamId: 'team_1',
      strongPairs: [{ names: ['Star Mid', 'Elite Jungle'], score: 85, tag: 'duo' }],
      riskPairs: [],
      mentorLinks: [{ names: ['Star Mid', 'Rookie Top'], score: 76, tag: 'mentor' }],
      staffTrust: 68,
      moraleImpact: 6,
      transferImpact: 10,
      summary: '',
    });

    const result = await evaluateIncomingTransferOffer({
      teamId: 'team_1',
      playerId: 'player_1',
      transferFee: 10000,
      offeredSalary: 3000,
      contractYears: 2,
    });

    expect(result.accepted).toBe(false);
    expect(result.counterOffer).toBeDefined();
    expect(result.counterOffer?.transferFee).toBeGreaterThan(20000);
  });

  it('keeps the counter lower when the player sits in a conflict pair', async () => {
    mockRelationshipSnapshot
      .mockResolvedValueOnce({
        teamId: 'team_1',
        strongPairs: [],
        riskPairs: [],
        mentorLinks: [],
        staffTrust: 60,
        moraleImpact: 0,
        transferImpact: 0,
        summary: '',
      })
      .mockResolvedValueOnce({
        teamId: 'team_1',
        strongPairs: [],
        riskPairs: [{ names: ['Star Mid', 'Frustrated Jungle'], score: 22, tag: 'rift' }],
        mentorLinks: [],
        staffTrust: 40,
        moraleImpact: -6,
        transferImpact: 0,
        summary: '',
      });

    const neutralResult = await evaluateIncomingTransferOffer({
      teamId: 'team_1',
      playerId: 'player_1',
      transferFee: 10000,
      offeredSalary: 3000,
      contractYears: 2,
    });

    const conflictResult = await evaluateIncomingTransferOffer({
      teamId: 'team_1',
      playerId: 'player_1',
      transferFee: 10000,
      offeredSalary: 3000,
      contractYears: 2,
    });

    expect(neutralResult.accepted).toBe(false);
    expect(conflictResult.accepted).toBe(false);
    expect(neutralResult.counterOffer).toBeDefined();
    expect(conflictResult.counterOffer).toBeDefined();
    expect(conflictResult.counterOffer?.transferFee).toBeLessThan(neutralResult.counterOffer?.transferFee ?? 0);
  });

  it('softens a locked stance when the club is under severe financial pressure', async () => {
    mockGetPlayerById.mockResolvedValueOnce({
      ...player,
      division: 'main',
      contract: {
        ...player.contract,
        contractEndSeason: 6,
      },
    });
    mockGetPlayersByTeamId.mockResolvedValueOnce([
      {
        ...player,
        division: 'main',
        contract: {
          ...player.contract,
          contractEndSeason: 6,
        },
      },
    ]);
    mockGetBudgetPressureSnapshot.mockResolvedValueOnce({
      currentBudget: 12000,
      weeklyRecurringExpenses: 9500,
      monthlyRecurringExpenses: 38000,
      recentNegotiationCosts: 5600,
      failedNegotiations: 3,
      playerSalaryTotal: 30000,
      staffSalaryTotal: 7000,
      effectiveStaffPayroll: 5600,
      salaryCap: 36000,
      totalPayroll: 39800,
      capRoom: -3800,
      luxuryTax: 2200,
      runwayWeeks: 1.2,
      pressureBand: 'hard_stop',
      boardSatisfaction: 38,
      boardRisk: 26,
      pressureScore: 78,
      pressureLevel: 'critical',
      boardPressureNote: 'Budget emergency.',
      topDrivers: ['Budget emergency.'],
    });
    mockGetTeamPayrollSnapshot.mockResolvedValueOnce({
      teamId: 'team_1',
      currentBudget: 12000,
      salaryCap: 36000,
      playerSalaryTotal: 30000,
      staffSalaryTotal: 7000,
      effectiveStaffPayroll: 5600,
      totalPayroll: 39800,
      capRoom: -3800,
      overage: 3800,
      luxuryTax: 2200,
      pressureBand: 'hard_stop',
    });

    const result = await evaluateIncomingTransferOffer({
      teamId: 'team_1',
      playerId: 'player_1',
      transferFee: 18000,
      offeredSalary: 3500,
      contractYears: 2,
    });

    expect(result.accepted).toBe(false);
    expect(result.counterOffer).toBeDefined();
    expect(result.reason).toContain('재정 압박');
  });

  it('keeps the asking price higher when board trust and finances are stable', async () => {
    mockGetBudgetPressureSnapshot
      .mockResolvedValueOnce({
        currentBudget: 180000,
        weeklyRecurringExpenses: 12000,
        monthlyRecurringExpenses: 48000,
        recentNegotiationCosts: 0,
        failedNegotiations: 0,
        playerSalaryTotal: 28000,
        staffSalaryTotal: 6000,
        effectiveStaffPayroll: 4800,
        salaryCap: 42000,
        totalPayroll: 32800,
        capRoom: 9200,
        luxuryTax: 0,
        runwayWeeks: 15,
        pressureBand: 'safe',
        boardSatisfaction: 74,
        boardRisk: 4,
        pressureScore: 12,
        pressureLevel: 'stable',
        boardPressureNote: '',
        topDrivers: [],
      })
      .mockResolvedValueOnce({
        currentBudget: 10000,
        weeklyRecurringExpenses: 9200,
        monthlyRecurringExpenses: 36800,
        recentNegotiationCosts: 5000,
        failedNegotiations: 3,
        playerSalaryTotal: 30000,
        staffSalaryTotal: 7000,
        effectiveStaffPayroll: 5600,
        salaryCap: 36000,
        totalPayroll: 39800,
        capRoom: -3800,
        luxuryTax: 2200,
        runwayWeeks: 1,
        pressureBand: 'hard_stop',
        boardSatisfaction: 39,
        boardRisk: 25,
        pressureScore: 80,
        pressureLevel: 'critical',
        boardPressureNote: '',
        topDrivers: [],
      });
    mockGetTeamPayrollSnapshot
      .mockResolvedValueOnce({
        teamId: 'team_1',
        currentBudget: 180000,
        salaryCap: 42000,
        playerSalaryTotal: 28000,
        staffSalaryTotal: 6000,
        effectiveStaffPayroll: 4800,
        totalPayroll: 32800,
        capRoom: 9200,
        overage: 0,
        luxuryTax: 0,
        pressureBand: 'safe',
      })
      .mockResolvedValueOnce({
        teamId: 'team_1',
        currentBudget: 10000,
        salaryCap: 36000,
        playerSalaryTotal: 30000,
        staffSalaryTotal: 7000,
        effectiveStaffPayroll: 5600,
        totalPayroll: 39800,
        capRoom: -3800,
        overage: 3800,
        luxuryTax: 2200,
        pressureBand: 'hard_stop',
      });

    const stableResult = await evaluateIncomingTransferOffer({
      teamId: 'team_1',
      playerId: 'player_1',
      transferFee: 10000,
      offeredSalary: 3000,
      contractYears: 2,
    });

    const distressedResult = await evaluateIncomingTransferOffer({
      teamId: 'team_1',
      playerId: 'player_1',
      transferFee: 10000,
      offeredSalary: 3000,
      contractYears: 2,
    });

    expect(stableResult.counterOffer).toBeDefined();
    expect(distressedResult.counterOffer).toBeDefined();
    expect(stableResult.counterOffer?.transferFee).toBeGreaterThan(distressedResult.counterOffer?.transferFee ?? 0);
  });
});
