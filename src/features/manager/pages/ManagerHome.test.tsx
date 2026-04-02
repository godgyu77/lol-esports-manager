import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { ManagerHome } from './ManagerHome';

const {
  mockGetMatchesByTeam,
  mockGetTeamTotalSalary,
  mockGetTeamConditions,
  mockGetRecentDailyEvents,
  mockGetExpiringContracts,
  mockGetPlayerManagementInsights,
  mockGetSatisfactionReport,
  mockGenerateStaffRecommendations,
  mockGetUnreadCount,
  mockGenerateDailyBriefing,
} = vi.hoisted(() => ({
  mockGetMatchesByTeam: vi.fn(),
  mockGetTeamTotalSalary: vi.fn(),
  mockGetTeamConditions: vi.fn(),
  mockGetRecentDailyEvents: vi.fn(),
  mockGetExpiringContracts: vi.fn(),
  mockGetPlayerManagementInsights: vi.fn(),
  mockGetSatisfactionReport: vi.fn(),
  mockGenerateStaffRecommendations: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockGenerateDailyBriefing: vi.fn(),
}));

vi.mock('../../../hooks/useBgm', () => ({
  useBgm: vi.fn(),
}));

vi.mock('../../tutorial/TutorialOverlay', () => ({
  TutorialOverlay: () => null,
}));

vi.mock('../components/MeetingModal', () => ({
  MeetingModal: () => null,
}));

vi.mock('../../../ai/advancedAiService', () => ({
  generateDailyBriefing: mockGenerateDailyBriefing,
}));

vi.mock('../../../db/queries', () => ({
  getMatchesByTeam: mockGetMatchesByTeam,
  getRecentDailyEvents: mockGetRecentDailyEvents,
  getTeamConditions: mockGetTeamConditions,
  getTeamTotalSalary: mockGetTeamTotalSalary,
  getExpiringContracts: mockGetExpiringContracts,
}));

vi.mock('../../../engine/board/boardEngine', () => ({
  getBoardExpectations: vi.fn().mockResolvedValue({ satisfaction: 60 }),
}));

vi.mock('../../../engine/complaint/complaintEngine', () => ({
  getActiveComplaints: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../engine/injury/injuryEngine', () => ({
  getInjuredPlayerIds: vi.fn().mockResolvedValue(new Set()),
}));

vi.mock('../../../engine/news/newsEngine', () => ({
  getUnreadCount: mockGetUnreadCount,
}));

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
  getSatisfactionReport: mockGetSatisfactionReport,
  SATISFACTION_FACTOR_LABELS: {
    morale: '사기',
  },
}));

vi.mock('../../../engine/staff/staffEngine', () => ({
  generateStaffRecommendations: mockGenerateStaffRecommendations,
}));

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
        hardFearlessSeries: false,
        matchDate: '2026-03-03',
      },
    ]);
    mockGetTeamTotalSalary.mockResolvedValue(250000);
    mockGetTeamConditions.mockResolvedValue(new Map());
    mockGetRecentDailyEvents.mockResolvedValue([]);
    mockGetExpiringContracts.mockResolvedValue([]);
    mockGetPlayerManagementInsights.mockResolvedValue([]);
    mockGetSatisfactionReport.mockResolvedValue([]);
    mockGenerateStaffRecommendations.mockResolvedValue([]);
    mockGetUnreadCount.mockResolvedValue(2);
    mockGenerateDailyBriefing.mockResolvedValue({
      briefing: '오늘은 다음 경기 준비가 핵심입니다.',
      alerts: ['읽지 않은 뉴스가 있습니다.'],
      advice: ['훈련 방향을 먼저 확인하세요.'],
    });
  });

  it('surfaces the main loop summary and primary actions on one screen', async () => {
    renderWithProviders(<ManagerHome />, {
      gameState: {
        save: {
          id: 1,
          userTeamId: 'lck_T1',
          currentSeasonId: 1,
          currentTeamId: 'lck_T1',
          gameMode: 'manager',
        },
        season: {
          id: 1,
          year: 2026,
          split: 'spring',
          currentDate: '2026-03-01',
          currentWeek: 1,
          endDate: '2026-06-01',
        },
        teams: [
          {
            id: 'lck_T1',
            name: 'T1',
            shortName: 'T1',
            region: 'LCK',
            budget: 500000,
            reputation: 85,
            roster: [],
          },
          {
            id: 'lck_GEN',
            name: 'Gen.G',
            shortName: 'GEN',
            region: 'LCK',
            budget: 450000,
            reputation: 84,
            roster: [],
          },
        ],
      },
      settingsState: {
        tutorialComplete: true,
      },
    });

    expect(await screen.findByText('Manager Loop')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '시즌 진행' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: '훈련 보기' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: '전술 보기' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: '뉴스 확인' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/2026-03-03/).length).toBeGreaterThanOrEqual(1);
  });
});
