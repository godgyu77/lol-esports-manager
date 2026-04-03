import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPlayerById = vi.fn();
const mockGetActiveSeason = vi.fn();
const mockGetPlayersByTeamId = vi.fn();
const mockGetDatabase = vi.fn();
const mockRelationshipSnapshot = vi.fn();

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
  getTeamPayrollSnapshot: vi.fn(),
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
});
