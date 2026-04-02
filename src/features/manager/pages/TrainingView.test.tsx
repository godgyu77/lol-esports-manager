import { renderWithProviders, screen, waitFor, within, resetStores } from '../../../test/testUtils';
import { TrainingView } from './TrainingView';

const {
  mockGetTrainingSchedule,
  mockGetPlayerTraining,
  mockGetRecentTrainingLogs,
  mockGetMentoringPairs,
  mockGetEligibleMentors,
  mockGetEligibleMentees,
  mockGetRecentScrims,
  mockGenerateInitialCoachRecommendations,
} = vi.hoisted(() => ({
  mockGetTrainingSchedule: vi.fn(),
  mockGetPlayerTraining: vi.fn(),
  mockGetRecentTrainingLogs: vi.fn(),
  mockGetMentoringPairs: vi.fn(),
  mockGetEligibleMentors: vi.fn(),
  mockGetEligibleMentees: vi.fn(),
  mockGetRecentScrims: vi.fn(),
  mockGenerateInitialCoachRecommendations: vi.fn(),
}));

vi.mock('../../../engine/training/trainingEngine', () => ({
  getTrainingSchedule: mockGetTrainingSchedule,
  setTrainingSchedule: vi.fn().mockResolvedValue(undefined),
  getPlayerTraining: mockGetPlayerTraining,
  setPlayerTraining: vi.fn().mockResolvedValue(undefined),
  getRecentTrainingLogs: mockGetRecentTrainingLogs,
}));

vi.mock('../../../engine/mentoring/mentoringEngine', () => ({
  getMentoringPairs: mockGetMentoringPairs,
  getEligibleMentors: mockGetEligibleMentors,
  getEligibleMentees: mockGetEligibleMentees,
  assignMentor: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  removeMentor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../engine/season/scrimEngine', () => ({
  getRecentScrims: mockGetRecentScrims,
  getTrainingRecommendation: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../engine/news/newsEngine', () => ({
  generateScrimBriefing: vi.fn().mockResolvedValue(undefined),
  generateTrainingDigest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../engine/manager/managerSetupEngine', () => ({
  applyCoachTrainingRecommendation: vi.fn().mockResolvedValue(undefined),
  generateInitialCoachRecommendations: mockGenerateInitialCoachRecommendations,
}));

describe('TrainingView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetTrainingSchedule.mockResolvedValue([
      { dayOfWeek: 1, activityType: 'training', trainingType: 'macro', intensity: 'normal' },
    ]);
    mockGetPlayerTraining.mockResolvedValue([]);
    mockGetRecentTrainingLogs.mockResolvedValue([]);
    mockGetMentoringPairs.mockResolvedValue([]);
    mockGetEligibleMentors.mockResolvedValue([]);
    mockGetEligibleMentees.mockResolvedValue([]);
    mockGetRecentScrims.mockResolvedValue([]);
    mockGenerateInitialCoachRecommendations.mockResolvedValue([]);
  });

  it('shows the loop summary and supports keyboard toolbar navigation', async () => {
    const { user } = renderWithProviders(<TrainingView />, {
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
          { id: 'lck_T1', name: 'T1', shortName: 'T1', roster: [], budget: 0, reputation: 80 },
          { id: 'lck_GEN', name: 'GEN', shortName: 'GEN', roster: [], budget: 0, reputation: 79 },
        ],
        pendingUserMatch: {
          id: 'match-1',
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
      },
    });

    expect(await screen.findByText('Training Loop')).toBeInTheDocument();

    const toolbar = screen.getByRole('tablist');
    const buttons = within(toolbar).getAllByRole('tab');

    buttons[0].focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => {
      expect(buttons[1]).toHaveFocus();
      expect(buttons[1]).toHaveClass('fm-tab--active');
    });
  });
});
