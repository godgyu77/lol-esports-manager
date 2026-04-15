import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { ManagerHome } from './ManagerHome';
import type { Team } from '../../../types/team';

const {
  mockNavigate,
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
  mockGetInboxMessages,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
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
  mockGetInboxMessages: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
vi.mock('../../../engine/inbox/inboxEngine', () => ({ getInboxMessages: mockGetInboxMessages }));
vi.mock('../../../engine/news/newsEngine', () => ({ getUnreadCount: mockGetUnreadCount }));
vi.mock('../../../engine/manager/managerIdentityEngine', () => ({
  getManagerIdentity: vi.fn().mockResolvedValue(null),
  getManagerIdentitySummaryLine: vi.fn().mockReturnValue('identity summary'),
  MANAGER_PHILOSOPHY_LABELS: {
    discipline: '규율',
    playerCare: '케어',
    analytics: '분석',
    aggression: '공격성',
  },
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

const teams: Team[] = [
  { id: 'lck_T1', name: 'T1', shortName: 'T1', region: 'LCK', budget: 500000, salaryCap: 400000, reputation: 85, roster: [], playStyle: 'controlled' },
  { id: 'lck_GEN', name: 'Gen.G', shortName: 'GEN', region: 'LCK', budget: 450000, salaryCap: 400000, reputation: 84, roster: [], playStyle: 'controlled' },
];

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
    teams,
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
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetBudgetPressureSnapshot.mockResolvedValue({
      totalPayroll: 0,
      salaryCap: 0,
      pressureLevel: 'watch',
      topDrivers: ['최근 지출 흐름을 다시 점검해야 합니다.'],
    });
    mockGetActiveConsequences.mockResolvedValue([]);
    mockGetPrepRecommendationRecords.mockResolvedValue([]);
    mockGetMainLoopRiskItems.mockResolvedValue([
      { title: '재정 압박', summary: '최근 지출 흐름을 다시 점검해야 합니다.', tone: 'risk' },
    ]);
  });

  it('renders the main loop summary cards and spotlight panel', async () => {
    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByText('60/100')).toBeInTheDocument();
    expect(screen.getAllByText(/Payroll 0\.00/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('managerhome-priority-strip')).toBeInTheDocument();
    expect(screen.getByText(/吏湲/)).toBeInTheDocument();
    expect(screen.getByTestId('managerhome-spotlight-panel')).toBeInTheDocument();
  });

  it('still renders safely when board satisfaction is missing', async () => {
    mockGetBoardExpectations.mockResolvedValue(null);

    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByTestId('managerhome-spotlight-panel')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThan(0);
  });

  it('prioritizes the latest match follow-up on the home loop when inbox has a result memo', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 21,
        teamId: 'lck_T1',
        category: 'general',
        title: '[경기 결과] GEN전 0:2 패배',
        content: '다음 권장 행동은 전술 재검토입니다.',
        isRead: false,
        actionRequired: true,
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
        createdDate: '2026-03-02',
        dismissOnRead: false,
        sticky: true,
      },
    ]);

    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findAllByRole('button', { name: /경기 후속 정리/ })).not.toHaveLength(0);
    expect(screen.getAllByText(/직전 경기 후속/)).not.toHaveLength(0);
  });

  it('shows a spotlight choice that nudges exploration beyond the urgent loop', async () => {
    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByTestId('managerhome-spotlight-panel')).toBeInTheDocument();
    expect(screen.getByText(/오늘 가장 재밌는 선택/)).toBeInTheDocument();
  });

  it('shows a first-season retention panel with a season-story nudge', async () => {
    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByTestId('managerhome-retention-panel')).toBeInTheDocument();
    expect(screen.getByText('첫 시즌 몰입 포인트')).toBeInTheDocument();
    expect(screen.getAllByText(/첫 인상 만들기|첫 시즌 흐름 만들기/).length).toBeGreaterThan(0);
  });

  it('routes top board pressure notes to finance from the home loop', async () => {
    mockGetMainLoopRiskItems.mockResolvedValue([
      {
        title: '보드 신뢰 경고',
        summary: '보드가 최근 운영 선택을 재정 압박과 함께 보고 있어 지금 바로 점검이 필요합니다.',
        tone: 'risk',
      },
    ]);

    renderWithProviders(<ManagerHome />, baseProps);

    const boardNote = await screen.findAllByRole('button', { name: /보드 신뢰 경고/ });
    boardNote[0].click();

    expect(mockNavigate).toHaveBeenCalledWith('/manager/finance');
  });
});
