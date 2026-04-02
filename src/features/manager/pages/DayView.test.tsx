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
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAdvanceDay: vi.fn(),
  mockSkipToNextMatchDay: vi.fn(),
  mockGetManagerSetupStatus: vi.fn(),
  mockGenerateInitialCoachRecommendations: vi.fn(),
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
  id: 'save-1',
  userTeamId: 'team-user',
  seasonId: 'season-1',
  currentDate: '2025-01-15',
  managerName: '테스트 감독',
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

    const advanceButton = await screen.findByRole('button', { name: '하루 진행' });
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

    const skipButton = await screen.findByRole('button', { name: '다음 경기까지 건너뛰기' });
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

  it('shows the coach briefing and disables progression when setup is incomplete', async () => {
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
        headline: '훈련안을 먼저 잡아야 합니다.',
        summary: '라인전 보완이 우선입니다.',
        reasons: ['훈련 계획이 없습니다.'],
        payload: [],
      },
      {
        id: 'tactics-team-user',
        kind: 'tactics',
        authorStaffId: 2,
        authorName: '박 분석관',
        authorRole: 'analyst',
        headline: '기본 전술을 먼저 확정해 주세요.',
        summary: '오브젝트 운영 중심 전술입니다.',
        reasons: ['전술 설정이 없습니다.'],
        payload: {
          earlyStrategy: 'standard',
          midStrategy: 'balanced',
          lateStrategy: 'teamfight',
          wardPriority: 'balanced',
          dragonPriority: 5,
          baronPriority: 5,
          aggressionLevel: 5,
        },
      },
    ]);

    renderWithProviders(<DayView />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
    });

    expect(await screen.findByText('코치 브리핑: 진행 전 필수 세팅')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '훈련 추천 적용' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '전술 추천 적용' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '하루 진행' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 경기까지 건너뛰기' })).toBeDisabled();
  });
});
