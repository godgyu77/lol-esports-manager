import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { within } from '@testing-library/react';
import { FinanceView } from './FinanceView';

const {
  mockGetActiveSponsors,
  mockGetTeamFinanceSummary,
  mockGetTeamWithRoster,
  mockGetManagerIdentity,
  mockGetBudgetPressureSnapshot,
} = vi.hoisted(() => ({
  mockGetActiveSponsors: vi.fn(),
  mockGetTeamFinanceSummary: vi.fn(),
  mockGetTeamWithRoster: vi.fn(),
  mockGetManagerIdentity: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
}));

vi.mock('../../../db/queries', () => ({
  getActiveSponsors: mockGetActiveSponsors,
  getTeamFinanceSummary: mockGetTeamFinanceSummary,
  getTeamWithRoster: mockGetTeamWithRoster,
}));

vi.mock('../../../engine/economy/sponsorEngine', () => ({
  acceptSponsor: vi.fn(),
  generateSponsorOffers: vi.fn().mockReturnValue([]),
  MAX_ACTIVE_SPONSORS: 3,
  MAX_REROLLS_PER_SEASON: 3,
  SPONSOR_CONDITION_LABELS: {},
  SPONSOR_STYLE_LABELS: {
    fixed: '안정형',
    performance: '성과형',
    promotion: '홍보형',
  },
  SPONSOR_TIER_COLORS: {
    local: '#999999',
    regional: '#4caf50',
    global: '#ffb300',
  },
  SPONSOR_TIER_LABELS: {
    local: '로컬',
    regional: '리저널',
    global: '글로벌',
  },
}));

vi.mock('../../../engine/manager/managerIdentityEngine', () => ({
  getManagerIdentity: mockGetManagerIdentity,
  getManagerIdentityEffects: vi.fn().mockReturnValue({ sponsorReputationBonus: 0 }),
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getBudgetPressureSnapshot: mockGetBudgetPressureSnapshot,
}));

describe('FinanceView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    mockGetTeamFinanceSummary.mockResolvedValue({
      totalIncome: 28000,
      totalExpense: 46000,
      balance: -18000,
      logs: [],
    });
    mockGetTeamWithRoster.mockResolvedValue({
      id: 'lck_T1',
      budget: 12000,
      reputation: 86,
      roster: [],
    });
    mockGetActiveSponsors.mockResolvedValue([]);
    mockGetManagerIdentity.mockResolvedValue(null);
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
      runwayWeeks: 1.3,
      pressureBand: 'hard_stop',
      boardSatisfaction: 39,
      boardRisk: 25,
      pressureScore: 80,
      pressureLevel: 'critical',
      boardPressureNote: '보드가 당장 예산 정리 계획을 요구하고 있습니다.',
      topDrivers: ['보드가 당장 예산 정리 계획을 요구하고 있습니다.'],
    });
  });

  it('shows a compact finance priority strip before the detailed tables', async () => {
    renderWithProviders(<FinanceView />, {
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
        teams: [
          {
            id: 'lck_T1',
            name: 'T1',
            shortName: 'T1',
            region: 'LCK',
            budget: 12000,
            salaryCap: 36000,
            reputation: 86,
            roster: [],
            playStyle: 'controlled',
          },
        ],
      },
    });

    const priorityStrip = await screen.findByTestId('finance-priority-strip');
    expect(priorityStrip).toBeInTheDocument();
    expect(screen.getByText('가장 큰 경고')).toBeInTheDocument();
    expect(screen.getByText('지출 압박')).toBeInTheDocument();
    expect(screen.getByText('다음 행동')).toBeInTheDocument();
    expect(within(priorityStrip).getByText('보드가 당장 예산 정리 계획을 요구하고 있습니다.')).toBeInTheDocument();
    expect(within(priorityStrip).getByText(/스폰서 확보와 지출 축소를 먼저 진행하세요/)).toBeInTheDocument();
  });
});
