import { renderWithProviders, screen, waitFor, resetStores } from '../../../test/testUtils';
import { PreMatchView } from './PreMatchView';

const {
  mockNavigate,
  mockGetPlayersByTeamId,
  mockGetStandings,
  mockGenerateOpponentReport,
  mockBuildCompetitiveOperationBrief,
  mockGetInboxMessages,
  mockGetManagerIdentity,
  mockGetManagerIdentitySummaryLine,
  mockGetActiveInterventionEffects,
  mockGetBudgetPressureSnapshot,
  mockGetPrepRecommendationRecords,
  mockGetInternationalExpectationSnapshot,
  mockGenerateStaffRecommendations,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetPlayersByTeamId: vi.fn(),
  mockGetStandings: vi.fn(),
  mockGenerateOpponentReport: vi.fn(),
  mockBuildCompetitiveOperationBrief: vi.fn(),
  mockGetInboxMessages: vi.fn(),
  mockGetManagerIdentity: vi.fn(),
  mockGetManagerIdentitySummaryLine: vi.fn(),
  mockGetActiveInterventionEffects: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
  mockGetPrepRecommendationRecords: vi.fn(),
  mockGetInternationalExpectationSnapshot: vi.fn(),
  mockGenerateStaffRecommendations: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../db/queries', () => ({
  getPlayersByTeamId: mockGetPlayersByTeamId,
  getStandings: mockGetStandings,
}));

vi.mock('../../../engine/analysis/matchAnalysisEngine', () => ({
  generateOpponentReport: mockGenerateOpponentReport,
}));

vi.mock('../../../engine/manager/competitiveIdentityEngine', () => ({
  buildCompetitiveOperationBrief: mockBuildCompetitiveOperationBrief,
}));

vi.mock('../../../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
}));

vi.mock('../../../engine/manager/managerIdentityEngine', () => ({
  getManagerIdentity: mockGetManagerIdentity,
  getManagerIdentitySummaryLine: mockGetManagerIdentitySummaryLine,
}));

vi.mock('../../../engine/manager/managerInterventionEngine', () => ({
  getActiveInterventionEffects: mockGetActiveInterventionEffects,
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getBudgetPressureSnapshot: mockGetBudgetPressureSnapshot,
  getPrepRecommendationRecords: mockGetPrepRecommendationRecords,
}));

vi.mock('../../../engine/manager/releaseDepthEngine', () => ({
  getInternationalExpectationSnapshot: mockGetInternationalExpectationSnapshot,
}));

vi.mock('../../../engine/staff/staffEngine', () => ({
  generateStaffRecommendations: mockGenerateStaffRecommendations,
}));

describe('PreMatchView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    mockGetPlayersByTeamId.mockResolvedValue([]);
    mockGetStandings.mockResolvedValue([]);
    mockGenerateOpponentReport.mockResolvedValue(null);
    mockBuildCompetitiveOperationBrief.mockResolvedValue(null);
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetManagerIdentity.mockResolvedValue(null);
    mockGetManagerIdentitySummaryLine.mockReturnValue('identity');
    mockGetActiveInterventionEffects.mockResolvedValue(new Map());
    mockGetBudgetPressureSnapshot.mockResolvedValue(null);
    mockGetPrepRecommendationRecords.mockResolvedValue([]);
    mockGetInternationalExpectationSnapshot.mockResolvedValue(null);
    mockGenerateStaffRecommendations.mockResolvedValue([]);
  });

  const gameState = {
    save: {
      id: 1,
      metadataId: 1,
      mode: 'manager' as const,
      userTeamId: 'lck_T1',
      currentSeasonId: 1,
      dbFilename: 'test.db',
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
      slotNumber: 1,
      saveName: 'Test Save',
      playTimeMinutes: 0,
    },
    season: {
      id: 1,
      year: 2026,
      split: 'spring' as const,
      currentDate: '2026-03-03',
      currentWeek: 1,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      isActive: true,
    },
    teams: [
      { id: 'lck_T1', name: 'T1', shortName: 'T1', region: 'LCK' as const, roster: [], budget: 0, salaryCap: 400000, reputation: 80, playStyle: 'controlled' as const },
      { id: 'lck_GEN', name: 'Gen.G', shortName: 'GEN', region: 'LCK' as const, roster: [], budget: 0, salaryCap: 400000, reputation: 79, playStyle: 'controlled' as const },
    ],
    pendingUserMatch: {
      id: 'match-2',
      seasonId: 1,
      week: 1,
      teamHomeId: 'lck_T1',
      teamAwayId: 'lck_GEN',
      scoreHome: 0,
      scoreAway: 0,
      isPlayed: false,
      games: [],
      matchType: 'regular' as const,
      boFormat: 'Bo3' as const,
      hardFearlessSeries: false,
      matchDate: '2026-03-03',
    },
    recommendedBans: [],
  };

  it('shows the latest match follow-up in the pre-match briefing', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 1,
        teamId: 'lck_T1',
        type: 'general',
        title: '[경기 결과] T1 vs GEN',
        content: '다음 권장 행동은 전술 점검입니다.',
        isRead: false,
        createdAt: '2026-03-01T10:00:00.000Z',
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
      },
    ]);

    renderWithProviders(<PreMatchView />, { gameState });

    expect(await screen.findByTestId('prematch-followup-panel')).toBeInTheDocument();
    expect(screen.getByText('[경기 결과] T1 vs GEN')).toBeInTheDocument();
    expect(screen.getByTestId('prematch-stakes-panel')).toBeInTheDocument();
    expect(screen.getByText('직전 경기 후속이 걸린 매치')).toBeInTheDocument();

    screen.getByRole('button', { name: '직전 경기 정리하러 가기' }).click();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/manager/tactics');
    });
  });

  it('surfaces a high-stakes note for international pressure matches', async () => {
    mockGetInternationalExpectationSnapshot.mockResolvedValue({
      teamId: 'lck_T1',
      seasonId: 1,
      label: '국제전 압박',
      level: 'must_deliver',
      summary: '이번 경기 결과는 국제전 기대치와 직결됩니다.',
      styleClash: '운영 안정감을 증명해야 합니다.',
      boardPressureNote: '보드 압박',
      legacyImpact: 'legacy',
      tags: ['international'],
    });

    renderWithProviders(<PreMatchView />, { gameState });

    expect(await screen.findByTestId('prematch-stakes-panel')).toBeInTheDocument();
    expect(screen.getByText('국제전 기대가 걸린 검증전')).toBeInTheDocument();
    expect(screen.getAllByText('이번 경기 결과는 국제전 기대치와 직결됩니다.')).toHaveLength(2);
  });
});
