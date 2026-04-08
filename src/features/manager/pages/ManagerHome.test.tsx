import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { ManagerHome } from './ManagerHome';

const {
  mockGetMatchesByTeam,
  mockGetTeamConditions,
  mockGetRecentDailyEvents,
  mockGetExpiringContracts,
  mockGetPlayerManagementInsights,
  mockGenerateStaffRecommendations,
  mockGetStaffFitSummary,
  mockGetUnreadCount,
  mockGenerateDailyBriefing,
  mockGetBudgetPressureSnapshot,
  mockGetActiveConsequences,
  mockGetPrepRecommendationRecords,
  mockGetMainLoopRiskItems,
  mockGetBoardExpectations,
} = vi.hoisted(() => ({
  mockGetMatchesByTeam: vi.fn(),
  mockGetTeamConditions: vi.fn(),
  mockGetRecentDailyEvents: vi.fn(),
  mockGetExpiringContracts: vi.fn(),
  mockGetPlayerManagementInsights: vi.fn(),
  mockGenerateStaffRecommendations: vi.fn(),
  mockGetStaffFitSummary: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockGenerateDailyBriefing: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
  mockGetActiveConsequences: vi.fn(),
  mockGetPrepRecommendationRecords: vi.fn(),
  mockGetMainLoopRiskItems: vi.fn(),
  mockGetBoardExpectations: vi.fn(),
}));

vi.mock('../../../hooks/useBgm', () => ({ useBgm: vi.fn() }));
vi.mock('../../tutorial/TutorialOverlay', () => ({ TutorialOverlay: () => null }));
vi.mock('../../../ai/advancedAiService', () => ({ generateDailyBriefing: mockGenerateDailyBriefing }));
vi.mock('../../../db/queries', () => ({
  getMatchesByTeam: mockGetMatchesByTeam,
  getRecentDailyEvents: mockGetRecentDailyEvents,
  getTeamConditions: mockGetTeamConditions,
  getExpiringContracts: mockGetExpiringContracts,
}));
vi.mock('../../../engine/board/boardEngine', () => ({ getBoardExpectations: mockGetBoardExpectations }));
vi.mock('../../../engine/complaint/complaintEngine', () => ({ getActiveComplaints: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../engine/news/newsEngine', () => ({ getUnreadCount: mockGetUnreadCount }));
vi.mock('../../../engine/manager/managerIdentityEngine', () => ({
  getManagerIdentity: vi.fn().mockResolvedValue(null),
  getManagerIdentitySummaryLine: vi.fn().mockReturnValue('identity summary'),
  MANAGER_PHILOSOPHY_LABELS: { discipline: '규율', playerCare: '케어', analytics: '분석', aggression: '공격성' },
}));
vi.mock('../../../engine/satisfaction/playerSatisfactionEngine', () => ({
  getPlayerManagementInsights: mockGetPlayerManagementInsights,
  SATISFACTION_FACTOR_LABELS: { morale: '사기' },
}));
vi.mock('../../../engine/staff/staffEngine', () => ({
  generateStaffRecommendations: mockGenerateStaffRecommendations,
  getStaffFitSummary: mockGetStaffFitSummary,
}));
vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getBudgetPressureSnapshot: mockGetBudgetPressureSnapshot,
  getActiveConsequences: mockGetActiveConsequences,
  getPrepRecommendationRecords: mockGetPrepRecommendationRecords,
  getMainLoopRiskItems: mockGetMainLoopRiskItems,
}));
vi.mock('../../../engine/season/offseasonEngine', () => ({
  getCurrentOffseasonState: vi.fn().mockResolvedValue(null),
  OFFSEASON_PHASE_LABELS: {
    preseason: '프리시즌',
    transfer_window: '이적 시장',
    contract_window: '계약 기간',
    bootcamp: '부트캠프',
    break: '휴식',
  },
}));

const baseProps = {
  gameState: {
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
      currentDate: '2026-03-01',
      currentWeek: 1,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      isActive: true,
    },
    teams: [
      { id: 'lck_T1', name: 'T1', shortName: 'T1', region: 'LCK', budget: 500000, salaryCap: 400000, reputation: 85, roster: [], playStyle: 'controlled' },
      { id: 'lck_GEN', name: 'Gen.G', shortName: 'GEN', region: 'LCK', budget: 450000, salaryCap: 400000, reputation: 84, roster: [], playStyle: 'controlled' },
    ],
  },
  settingsState: { tutorialComplete: true },
};

describe('ManagerHome', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetMatchesByTeam.mockResolvedValue([
      {
        id: 1,
        seasonId: 1,
        teamHomeId: 'lck_T1',
        teamAwayId: 'lck_GEN',
        scoreHome: 0,
        scoreAway: 0,
        isPlayed: false,
        games: [],
        matchType: 'regular',
        boFormat: 'Bo3',
        matchDate: '2026-03-03',
      },
    ]);
    mockGetTeamConditions.mockResolvedValue(new Map());
    mockGetRecentDailyEvents.mockResolvedValue([]);
    mockGetExpiringContracts.mockResolvedValue([]);
    mockGetPlayerManagementInsights.mockResolvedValue([]);
    mockGenerateStaffRecommendations.mockResolvedValue([]);
    mockGetStaffFitSummary.mockResolvedValue([]);
    mockGetUnreadCount.mockResolvedValue(2);
    mockGenerateDailyBriefing.mockResolvedValue({
      briefing: '오늘은 다음 경기를 준비하며 운영 흐름을 정리할 시간입니다.',
      alerts: ['읽지 않은 뉴스가 있습니다.'],
      advice: ['훈련 방향과 다음 일정을 먼저 확인해 주세요.'],
    });
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 60 });
    mockGetBudgetPressureSnapshot.mockResolvedValue({
      totalPayroll: 0,
      salaryCap: 0,
      pressureLevel: 'watch',
      topDrivers: ['최근 지출 흐름을 다시 점검해야 합니다.'],
    });
    mockGetActiveConsequences.mockResolvedValue([]);
    mockGetPrepRecommendationRecords.mockResolvedValue([]);
    mockGetMainLoopRiskItems.mockResolvedValue([{ title: '재정 압박', summary: '최근 지출 흐름을 다시 점검해야 합니다.' }]);
  });

  it('메인 루프 요약과 주요 액션을 보여준다', async () => {
    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByText('매니저 루프')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '시즌 진행' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '훈련 보기' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '전술 보기' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '읽지 않은 뉴스 2건이 있습니다.' }).length).toBeGreaterThan(0);
    expect(screen.getByText('60/100')).toBeInTheDocument();
    expect(screen.getAllByText(/Payroll 0\.00억 \/ cap 0\.00억/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('상세 운영 메모 보기')).toBeInTheDocument();
  });

  it('board 값이 null 이어도 크래시 없이 렌더된다', async () => {
    mockGetBoardExpectations.mockResolvedValue(null);

    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByText('매니저 루프')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });
});
