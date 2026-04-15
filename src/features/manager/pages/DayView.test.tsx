import { renderWithProviders, screen, waitFor, resetStores } from '../../../test/testUtils';
import { DayView } from './DayView';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import type { GameSave, Team } from '../../../types';
import type { Season } from '../../../types/game';

const {
  mockNavigate,
  mockAdvanceDay,
  mockSkipToNextMatchDay,
  mockGetInboxMessages,
  mockGetManagerSetupStatus,
  mockGenerateInitialCoachRecommendations,
  mockGetBudgetPressureSnapshot,
  mockGetActiveConsequences,
  mockGetMainLoopRiskItems,
  mockGetPrepRecommendationRecords,
  mockGetCareerArcEvents,
  mockGetDatabase,
  mockGetMatchesByTeam,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAdvanceDay: vi.fn(),
  mockSkipToNextMatchDay: vi.fn(),
  mockGetInboxMessages: vi.fn(),
  mockGetManagerSetupStatus: vi.fn(),
  mockGenerateInitialCoachRecommendations: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
  mockGetActiveConsequences: vi.fn(),
  mockGetMainLoopRiskItems: vi.fn(),
  mockGetPrepRecommendationRecords: vi.fn(),
  mockGetCareerArcEvents: vi.fn(),
  mockGetDatabase: vi.fn(),
  mockGetMatchesByTeam: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../engine/season/dayAdvancer', () => ({
  advanceDay: mockAdvanceDay,
  skipToNextMatchDay: mockSkipToNextMatchDay,
}));

vi.mock('../../../db/queries', () => ({
  getActiveSeason: vi.fn().mockResolvedValue(null),
  getMatchesByTeam: mockGetMatchesByTeam,
}));

vi.mock('../../../db/database', () => ({
  getDatabase: mockGetDatabase,
}));

vi.mock('../../../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
}));

vi.mock('../../../engine/manager/managerIdentityEngine', () => ({
  getManagerIdentity: vi.fn().mockResolvedValue(null),
  getManagerIdentitySummaryLine: vi.fn().mockReturnValue('identity'),
}));

vi.mock('../../../engine/manager/managerInterventionEngine', () => ({
  getActiveInterventionEffects: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock('../../../engine/manager/managerSetupEngine', () => ({
  getManagerSetupStatus: mockGetManagerSetupStatus,
  generateInitialCoachRecommendations: mockGenerateInitialCoachRecommendations,
  applyCoachTrainingRecommendation: vi.fn().mockResolvedValue(undefined),
  applyCoachTacticsRecommendation: vi.fn().mockResolvedValue(undefined),
  ManagerSetupBlockedError: class extends Error {
    status;
    constructor(status: unknown) {
      super('blocked');
      this.status = status;
    }
  },
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getBudgetPressureSnapshot: mockGetBudgetPressureSnapshot,
  getActiveConsequences: mockGetActiveConsequences,
  getMainLoopRiskItems: mockGetMainLoopRiskItems,
  getPrepRecommendationRecords: mockGetPrepRecommendationRecords,
}));

vi.mock('../../../engine/manager/releaseDepthEngine', () => ({
  getCareerArcEvents: mockGetCareerArcEvents,
}));

vi.mock('../../../engine/staff/staffEngine', () => ({
  generateStaffRecommendations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../engine/training/trainingEngine', () => ({
  getTrainingSchedule: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

const mockSave = {
  id: 1,
  userTeamId: 'team-user',
  seasonId: 'season-1',
  currentDate: '2025-01-15',
  managerName: '?뚯뒪??媛먮룆',
  mode: 'manager',
  currentSeasonId: 1,
} as unknown as GameSave;

const mockSeason = {
  id: 1,
  year: 2025,
  split: 'spring',
  currentDate: '2025-01-15',
  currentWeek: 3,
  endDate: '2025-06-30',
} as Season;

const mockTeam = {
  id: 'team-user',
  name: 'T1',
  shortName: 'T1',
  region: 'LCK',
  roster: [],
  players: [],
} as unknown as Team;

const userMatch = {
  id: 'match-1',
  seasonId: 1,
  teamHomeId: 'team-user',
  teamAwayId: 'team-away',
  scoreHome: 0,
  scoreAway: 0,
  isPlayed: false,
  games: [],
  matchType: 'regular',
  boFormat: 'Bo3',
  hardFearlessSeries: true,
};

const stableBudgetPressure = {
  currentBudget: 50000,
  weeklyRecurringExpenses: 5000,
  monthlyRecurringExpenses: 20000,
  recentNegotiationCosts: 0,
  failedNegotiations: 0,
  playerSalaryTotal: 10000,
  staffSalaryTotal: 5000,
  effectiveStaffPayroll: 2500,
  salaryCap: 40000,
  totalPayroll: 12500,
  capRoom: 27500,
  luxuryTax: 0,
  runwayWeeks: 10,
  pressureBand: 'safe',
  boardSatisfaction: 70,
  boardRisk: 8,
  pressureScore: 16,
  pressureLevel: 'stable',
  boardPressureNote: 'Budget is stable.',
  topDrivers: ['Recurring costs are still within a manageable range.'],
} as const;

describe('DayView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetManagerSetupStatus.mockResolvedValue({
      isTrainingConfigured: true,
      isTacticsConfigured: true,
      isReadyToAdvance: true,
      blockingReasons: [],
    });
    mockGetInboxMessages.mockResolvedValue([]);
    mockGenerateInitialCoachRecommendations.mockResolvedValue([]);
    mockGetBudgetPressureSnapshot.mockResolvedValue(stableBudgetPressure);
    mockGetActiveConsequences.mockResolvedValue([]);
    mockGetMainLoopRiskItems.mockResolvedValue([]);
    mockGetPrepRecommendationRecords.mockResolvedValue([]);
    mockGetCareerArcEvents.mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({
      select: vi.fn().mockResolvedValue([]),
    });
    mockGetMatchesByTeam.mockResolvedValue([]);
  });

  it('moves to pre-match when advancing reaches a user match', async () => {
    mockAdvanceDay.mockResolvedValue({
      date: '2025-01-15',
      nextDate: '2025-01-16',
      dayType: 'match_day',
      events: [],
      hasUserMatch: true,
      userMatch,
      isSeasonEnd: false,
    });

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
    });

    const advanceButton = await screen.findByTestId('dayview-primary-advance');
    await waitFor(() => expect(advanceButton).toBeEnabled());
    advanceButton.click();

    await waitFor(() => {
      expect(useGameStore.getState().pendingUserMatch?.id).toBe('match-1');
      expect(useGameStore.getState().dayPhase).toBe('banpick');
      expect(useMatchStore.getState().hardFearlessSeries).toBe(true);
      expect(useMatchStore.getState().currentGameDraftRequired).toBe(true);
      expect(useMatchStore.getState().seriesFearlessPool).toEqual({ blue: [], red: [] });
      expect(mockNavigate).toHaveBeenCalledWith('/manager/pre-match');
    });
  });

  it('prepares the same pre-match state when skipping to the next match day', async () => {
    mockSkipToNextMatchDay.mockResolvedValue([
      {
        date: '2025-01-15',
        nextDate: '2025-01-16',
        dayType: 'training',
        events: [],
        hasUserMatch: false,
        isSeasonEnd: false,
      },
      {
        date: '2025-01-16',
        nextDate: '2025-01-17',
        dayType: 'match_day',
        events: [],
        hasUserMatch: true,
        userMatch,
        isSeasonEnd: false,
      },
    ]);

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
    });

    const skipButton = await screen.findByTestId('dayview-skip-action');
    await waitFor(() => expect(skipButton).toBeEnabled());
    skipButton.click();

    await waitFor(() => {
      expect(useGameStore.getState().pendingUserMatch?.id).toBe('match-1');
      expect(useGameStore.getState().dayPhase).toBe('banpick');
      expect(useMatchStore.getState().currentGameNum).toBe(1);
      expect(useMatchStore.getState().seriesScore).toEqual({ home: 0, away: 0 });
      expect(useMatchStore.getState().currentGameDraftRequired).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith('/manager/pre-match');
    });
  });

  it('prioritizes budget pressure ahead of routine progression', async () => {
    mockGetBudgetPressureSnapshot.mockResolvedValue({
      ...stableBudgetPressure,
      pressureScore: 58,
      pressureLevel: 'watch',
      runwayWeeks: 5.5,
      recentNegotiationCosts: 4200,
      failedNegotiations: 2,
      boardPressureNote: 'Board is watching spending closely.',
      topDrivers: ['Cash runway is down to about 5 weeks.'],
    });

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
    });

    expect(await screen.findByTestId('dayview-primary-budget')).toBeInTheDocument();
    expect(screen.getByTestId('dayview-primary-budget')).toHaveTextContent('재정 압박 점검');
  });

  it('shows the coach briefing priority when setup is incomplete', async () => {
    mockGetManagerSetupStatus.mockResolvedValue({
      isTrainingConfigured: false,
      isTacticsConfigured: false,
      isReadyToAdvance: false,
      blockingReasons: ['훈련 계획이 없습니다.', '전술 설정이 없습니다.'],
    });
    mockGenerateInitialCoachRecommendations.mockResolvedValue([
      {
        id: 'training-team-user',
        kind: 'training',
        authorStaffId: 1,
        authorName: '김 코치',
        authorRole: 'coach',
        headline: '훈련 설정을 먼저 마무리하세요.',
        summary: '주간 준비 루틴을 보완해야 합니다.',
        reasons: ['훈련 계획이 없습니다.'],
        payload: [],
      },
    ]);

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
    });

    expect(await screen.findByTestId('dayview-primary-setup-training')).toBeInTheDocument();
    expect(screen.getByTestId('dayview-skip-action')).toBeDisabled();
  });

  it('opens pre-match directly when today already has a scheduled user match', async () => {
    mockGetMatchesByTeam.mockResolvedValue([
      {
        ...userMatch,
        matchDate: '2025-01-15',
      },
    ]);

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam, { ...mockTeam, id: 'team-away', name: 'Gen.G', shortName: 'GEN' }] },
    });

    const prepButton = await screen.findByTestId('dayview-primary-match-prep');
    prepButton.click();

    await waitFor(() => {
      expect(useGameStore.getState().pendingUserMatch?.id).toBe('match-1');
      expect(useGameStore.getState().dayPhase).toBe('banpick');
      expect(useMatchStore.getState().boFormat).toBe('Bo3');
      expect(mockNavigate).toHaveBeenCalledWith('/manager/pre-match');
    });
  });

  it('prioritizes the latest match follow-up memo on the day loop', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 1,
        teamId: 'team-user',
        type: 'general',
        title: '[경기 결과] T1 vs GEN',
        content: '다음 권장 행동은 전술 재검토입니다.',
        isRead: false,
        createdAt: '2025-01-15T10:00:00.000Z',
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
      },
    ]);

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
    });

    const followUpButton = await screen.findByTestId('dayview-primary-followup');
    expect(followUpButton).toHaveTextContent('방금 경기 정리');
    followUpButton.click();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/manager/tactics');
    });
  });

  it('turns board and international loop risks into direct day actions', async () => {
    mockGetMainLoopRiskItems.mockResolvedValue([
      {
        title: '국제전 압박',
        summary: '이번 시리즈는 시즌 평가를 바꿀 수 있어 프리매치에서 준비 체인을 다시 점검해야 합니다.',
        tone: 'risk',
      },
    ]);

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
    });

    const riskButton = await screen.findByTestId('dayview-primary-loop-risk');
    expect(riskButton).toHaveTextContent('국제전 압박 점검');
    riskButton.click();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/manager/pre-match');
    });
  });

  it('shows a spotlight action that invites exploration around the day flow', async () => {
    mockGetMatchesByTeam.mockResolvedValue([
      {
        ...userMatch,
        matchDate: '2025-01-16',
      },
    ]);

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam, { ...mockTeam, id: 'team-away', name: 'Gen.G', shortName: 'GEN' }] },
    });

    expect(await screen.findByTestId('dayview-spotlight-panel')).toBeInTheDocument();
    expect(screen.getByText('오늘 가장 재밌는 선택')).toBeInTheDocument();
    expect(screen.getByText(/GEN전 흐름 미리 보기|방금 경기 여론 따라가기|오늘 팀 분위기 둘러보기/)).toBeInTheDocument();
  });
});
