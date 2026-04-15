import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateTransferOffer,
  mockGetActiveSeason,
  mockGetPlayerById,
  mockGetPlayersByTeamId,
  mockGetDatabase,
  mockAgentNegotiate,
  mockGetBudgetPressureSnapshot,
  mockGetRelationshipInfluenceSnapshot,
  mockRecordNegotiationExpense,
  mockCreateOngoingConsequence,
  mockGetTeamPayrollSnapshot,
} = vi.hoisted(() => ({
  mockCreateTransferOffer: vi.fn(),
  mockGetActiveSeason: vi.fn(),
  mockGetPlayerById: vi.fn(),
  mockGetPlayersByTeamId: vi.fn(),
  mockGetDatabase: vi.fn(),
  mockAgentNegotiate: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
  mockGetRelationshipInfluenceSnapshot: vi.fn(),
  mockRecordNegotiationExpense: vi.fn(),
  mockCreateOngoingConsequence: vi.fn(),
  mockGetTeamPayrollSnapshot: vi.fn(),
}));

vi.mock('../../db/queries', () => ({
  createTransferOffer: (...args: unknown[]) => mockCreateTransferOffer(...args),
  getActiveSeason: (...args: unknown[]) => mockGetActiveSeason(...args),
  getPlayerById: (...args: unknown[]) => mockGetPlayerById(...args),
  getPlayersByTeamId: (...args: unknown[]) => mockGetPlayersByTeamId(...args),
  updateTransferOfferTerms: vi.fn(),
}));

vi.mock('../../db/database', () => ({
  getDatabase: (...args: unknown[]) => mockGetDatabase(...args),
}));

vi.mock('../agent/agentEngine', () => ({
  agentNegotiate: (...args: unknown[]) => mockAgentNegotiate(...args),
}));

vi.mock('../rules/leagueRulesEngine', () => ({
  canSignForeignPlayer: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('./payrollEngine', () => ({
  evaluatePayrollImpact: vi.fn().mockReturnValue({ pressureBand: 'safe' }),
  getTeamPayrollSnapshot: (...args: unknown[]) => mockGetTeamPayrollSnapshot(...args),
}));

vi.mock('./transferTransactions', () => ({
  acceptFreeAgentOffer: vi.fn(),
  acceptTransferOffer: vi.fn(),
  cancelTransferOffer: vi.fn(),
  getFreeAgents: vi.fn(),
  getPlayerForAgent: vi.fn().mockResolvedValue({
    id: 'player_1',
    stats: { mechanical: 80, gameSense: 80, teamwork: 80, consistency: 80, laning: 80, aggression: 80 },
    mental: { mental: 75, stamina: 80, morale: 72 },
    age: 23,
    contract: { salary: 4000, contractEndSeason: 5 },
    potential: 88,
    popularity: 60,
  }),
  getTeamTransferOffers: vi.fn(),
  processExpiredContracts: vi.fn(),
  rejectTransferOffer: vi.fn(),
}));

vi.mock('./transferAi', () => ({
  processAIFreeAgentSignings: vi.fn(),
  processAITransfers: vi.fn(),
}));

vi.mock('../manager/systemDepthEngine', () => ({
  createOngoingConsequence: (...args: unknown[]) => mockCreateOngoingConsequence(...args),
  getBudgetPressureSnapshot: (...args: unknown[]) => mockGetBudgetPressureSnapshot(...args),
  recordNegotiationExpense: (...args: unknown[]) => mockRecordNegotiationExpense(...args),
}));

vi.mock('../manager/releaseDepthEngine', () => ({
  getRelationshipInfluenceSnapshot: (...args: unknown[]) => mockGetRelationshipInfluenceSnapshot(...args),
}));

import { offerTransfer } from './transferEngine';

describe('transferEngine negotiation aftermath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDatabase.mockResolvedValue({
      select: vi.fn((query: string) => {
        if (query.includes('SELECT budget, region FROM teams')) {
          return Promise.resolve([{ budget: 180000, region: 'LCK' }]);
        }
        return Promise.resolve([]);
      }),
    });
    mockGetActiveSeason.mockResolvedValue({ id: 3 });
    mockGetPlayerById.mockResolvedValue({
      id: 'player_1',
      name: 'Star Mid',
      teamId: 'team_2',
      position: 'mid',
      age: 23,
      nationality: 'KR',
      stats: { mechanical: 85, gameSense: 84, teamwork: 80, consistency: 82, laning: 84, aggression: 78 },
      mental: { mental: 76, stamina: 80, morale: 72 },
      contract: { salary: 4000, contractEndSeason: 4 },
      potential: 88,
      popularity: 60,
      championPool: [],
      peakAge: 24,
      secondaryPosition: null,
      playstyle: 'aggressive',
      careerGames: 100,
      chemistry: {},
      formHistory: [],
      division: 'sub',
    });
    mockGetPlayersByTeamId.mockResolvedValue([]);
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
    mockCreateTransferOffer.mockResolvedValue(77);
  });

  it('adds board and locker-room aftermath when a pressured negotiation fails', async () => {
    mockAgentNegotiate.mockResolvedValue({ accepted: false, message: '조건이 부족합니다.', counterOffer: 5200 });
    mockGetBudgetPressureSnapshot.mockResolvedValue({
      currentBudget: 12000,
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
      runwayWeeks: 1.2,
      pressureBand: 'hard_stop',
      boardSatisfaction: 39,
      boardRisk: 25,
      pressureScore: 80,
      pressureLevel: 'critical',
      boardPressureNote: 'Budget emergency.',
      topDrivers: ['Budget emergency.'],
    });
    mockGetRelationshipInfluenceSnapshot.mockResolvedValue({
      teamId: 'team_1',
      strongPairs: [],
      riskPairs: [{ names: ['Star Mid', 'Frustrated Jungle'], score: 22, tag: 'rift' }],
      mentorLinks: [],
      staffTrust: 42,
      moraleImpact: -4,
      transferImpact: 0,
      summary: '',
    });

    const result = await offerTransfer({
      seasonId: 3,
      fromTeamId: 'team_1',
      toTeamId: 'team_2',
      playerId: 'player_1',
      transferFee: 10000,
      offeredSalary: 3000,
      contractYears: 2,
      offerDate: '2026-04-15',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('조건이 부족합니다.');
    expect(result.reason).toContain('보드와 재정팀');
    expect(result.reason).toContain('선수단 내부');
    expect(mockCreateOngoingConsequence).toHaveBeenCalledTimes(2);
  });

  it('returns a positive market signal note when a stable club lands the offer', async () => {
    mockAgentNegotiate.mockResolvedValue({ accepted: true, message: '계약 가능.', counterOffer: 0 });
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
      boardSatisfaction: 74,
      boardRisk: 4,
      pressureScore: 12,
      pressureLevel: 'stable',
      boardPressureNote: '',
      topDrivers: [],
    });
    mockGetRelationshipInfluenceSnapshot.mockResolvedValue({
      teamId: 'team_1',
      strongPairs: [{ names: ['Star Mid', 'Elite Jungle'], score: 85, tag: 'duo' }],
      riskPairs: [],
      mentorLinks: [],
      staffTrust: 70,
      moraleImpact: 4,
      transferImpact: 6,
      summary: '',
    });

    const result = await offerTransfer({
      seasonId: 3,
      fromTeamId: 'team_1',
      toTeamId: 'team_2',
      playerId: 'player_1',
      transferFee: 18000,
      offeredSalary: 4500,
      contractYears: 3,
      offerDate: '2026-04-15',
    });

    expect(result.success).toBe(true);
    expect(result.offerId).toBe(77);
    expect(result.reason).toContain('보드가 이번 움직임을 시장 주도권 확보 신호로 받아들입니다.');
    expect(result.reason).toContain('팀 내부에서는 핵심 축을 지키거나 보강하려는 방향으로 읽히고 있습니다.');
  });
});
