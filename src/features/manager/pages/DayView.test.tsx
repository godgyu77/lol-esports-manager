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
  mockGetManagerSetupStatus,
  mockGenerateInitialCoachRecommendations,
  mockGetBudgetPressureSnapshot,
  mockGetActiveConsequences,
  mockGetPrepRecommendationRecords,
  mockGetCareerArcEvents,
  mockGetDatabase,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAdvanceDay: vi.fn(),
  mockSkipToNextMatchDay: vi.fn(),
  mockGetManagerSetupStatus: vi.fn(),
  mockGenerateInitialCoachRecommendations: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
  mockGetActiveConsequences: vi.fn(),
  mockGetPrepRecommendationRecords: vi.fn(),
  mockGetCareerArcEvents: vi.fn(),
  mockGetDatabase: vi.fn(),
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
}));

vi.mock('../../../db/database', () => ({
  getDatabase: mockGetDatabase,
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
    mockGenerateInitialCoachRecommendations.mockResolvedValue([]);
    mockGetBudgetPressureSnapshot.mockResolvedValue(stableBudgetPressure);
    mockGetActiveConsequences.mockResolvedValue([]);
    mockGetPrepRecommendationRecords.mockResolvedValue([]);
    mockGetCareerArcEvents.mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({
      select: vi.fn().mockResolvedValue([]),
    });
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
      blockingReasons: ['?덈젴 怨꾪쉷???놁뒿?덈떎.', '?꾩닠 ?ㅼ젙???놁뒿?덈떎.'],
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
});
