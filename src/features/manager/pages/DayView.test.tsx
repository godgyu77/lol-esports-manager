import { renderWithProviders, screen, waitFor, resetStores } from '../../../test/testUtils';
import { DayView } from './DayView';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import type { GameSave, Team } from '../../../types';
import type { Season } from '../../../types/game';

const { mockNavigate, mockAdvanceDay, mockSkipToNextMatchDay } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAdvanceDay: vi.fn(),
  mockSkipToNextMatchDay: vi.fn(),
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
  });

  it('하루 진행으로 유저 경기를 만나면 시리즈 상태를 초기화하고 프리매치로 이동한다', async () => {
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

    const advanceButton = screen.getByRole('button', { name: '하루 진행' });
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

  it('다음 경기까지 건너뛰기도 같은 방식으로 경기 준비 상태를 만든다', async () => {
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

    const skipButton = screen.getByRole('button', { name: '다음 경기까지 건너뛰기' });
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
});
