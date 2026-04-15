import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { TransferView } from './TransferView';
import type { Team } from '../../../types/team';

const {
  mockGetFreeAgents,
  mockGetPlayersByTeamId,
  mockGetTeamRecentWinRate,
  mockGetTeamTotalSalary,
  mockGetTeamTransferOffers,
  mockGetTeamNegotiations,
  mockGetBudgetPressureSnapshot,
} = vi.hoisted(() => ({
  mockGetFreeAgents: vi.fn(),
  mockGetPlayersByTeamId: vi.fn(),
  mockGetTeamRecentWinRate: vi.fn(),
  mockGetTeamTotalSalary: vi.fn(),
  mockGetTeamTransferOffers: vi.fn(),
  mockGetTeamNegotiations: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
}));

vi.mock('../../../db/queries', () => ({
  getFreeAgents: mockGetFreeAgents,
  getPlayersByTeamId: mockGetPlayersByTeamId,
  getTeamRecentWinRate: mockGetTeamRecentWinRate,
  getTeamTotalSalary: mockGetTeamTotalSalary,
}));

vi.mock('../../../engine/economy/contractEngine', () => ({
  aiPlayerRespondToOffer: vi.fn(),
  calculateRenewalOffer: vi.fn(),
  createNegotiation: vi.fn(),
  finalizeNegotiation: vi.fn(),
  generateDecisionFactors: vi.fn(),
  getTeamNegotiations: mockGetTeamNegotiations,
}));

vi.mock('../../../engine/economy/transferEngine', () => ({
  acceptFreeAgentOffer: vi.fn(),
  acceptTransferOffer: vi.fn(),
  calculateFairSalary: vi.fn().mockReturnValue(3000),
  calculatePlayerValue: vi.fn().mockReturnValue(18000),
  cancelTransferOffer: vi.fn(),
  evaluateOutgoingTransferCounter: vi.fn(),
  getTeamTransferOffers: mockGetTeamTransferOffers,
  offerFreeAgent: vi.fn(),
  offerTransfer: vi.fn(),
  respondToIncomingTransferOffer: vi.fn(),
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getBudgetPressureSnapshot: mockGetBudgetPressureSnapshot,
}));

const teams: Team[] = [
  {
    id: 'lck_T1',
    name: 'T1',
    shortName: 'T1',
    region: 'LCK',
    budget: 240000,
    salaryCap: 400000,
    reputation: 85,
    roster: [],
    playStyle: 'controlled',
  },
];

describe('TransferView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetFreeAgents.mockResolvedValue([]);
    mockGetPlayersByTeamId.mockResolvedValue([]);
    mockGetTeamRecentWinRate.mockResolvedValue(0.5);
    mockGetTeamTotalSalary.mockResolvedValue(18000);
    mockGetTeamTransferOffers.mockResolvedValue({ sent: [], received: [] });
    mockGetTeamNegotiations.mockResolvedValue([]);
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
      runwayWeeks: 1,
      pressureBand: 'hard_stop',
      boardSatisfaction: 39,
      boardRisk: 25,
      pressureScore: 80,
      pressureLevel: 'critical',
      boardPressureNote: '보드가 현금 확보를 요구하고 있습니다.',
      topDrivers: ['보드가 현금 확보를 요구하고 있습니다.'],
    });
  });

  it('shows a transfer market context alert when the club is under pressure', async () => {
    renderWithProviders(<TransferView />, {
      gameState: {
        save: {
          id: 1,
          metadataId: 1,
          mode: 'manager',
          userTeamId: 'lck_T1',
          currentSeasonId: 1,
          dbFilename: 'test.db',
          createdAt: '2026-04-15',
          updatedAt: '2026-04-15',
          slotNumber: 1,
          saveName: 'Test Save',
          playTimeMinutes: 0,
        },
        season: {
          id: 1,
          year: 2026,
          split: 'spring',
          currentDate: '2026-04-15',
          currentWeek: 8,
          startDate: '2026-01-01',
          endDate: '2026-06-01',
          isActive: true,
        },
        teams,
      },
    });

    expect(await screen.findByText('현금화 압박이 걸린 이적 시장')).toBeInTheDocument();
    expect(screen.getByText(/실패한 협상 비용도 더 아프게 남습니다/)).toBeInTheDocument();
    expect(screen.getByTestId('transfer-cap-summary')).toBeInTheDocument();
    expect(screen.getByText('샐캡:')).toBeInTheDocument();
    expect(screen.getByText('위험도:')).toBeInTheDocument();
    expect(screen.getByText('차단')).toBeInTheDocument();
    expect(screen.getByText('새 영입보다 방출·재계약 조정이 먼저 필요합니다.')).toBeInTheDocument();
  });
});
