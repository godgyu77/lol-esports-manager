import { renderWithProviders, screen, waitFor, within, resetStores } from '../../../test/testUtils';
import { TrainingView } from './TrainingView';

const {
  mockGetTrainingSchedule,
  mockGetPlayerTraining,
  mockGetRecentTrainingLogs,
  mockGetPrepRecommendationRecords,
  mockGetMentoringPairs,
  mockGetEligibleMentors,
  mockGetEligibleMentees,
  mockGetRecentScrims,
  mockGenerateInitialCoachRecommendations,
} = vi.hoisted(() => ({
  mockGetTrainingSchedule: vi.fn(),
  mockGetPlayerTraining: vi.fn(),
  mockGetRecentTrainingLogs: vi.fn(),
  mockGetPrepRecommendationRecords: vi.fn(),
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

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getPrepRecommendationRecords: mockGetPrepRecommendationRecords,
  recordPrepRecommendation: vi.fn().mockResolvedValue(undefined),
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
    mockGetPrepRecommendationRecords.mockResolvedValue([]);
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
          metadataId: 1,
          mode: 'manager',
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
          split: 'spring',
          currentDate: '2026-03-01',
          currentWeek: 1,
          startDate: '2026-01-01',
          endDate: '2026-06-01',
          isActive: true,
        },
        teams: [
          { id: 'lck_T1', name: 'T1', shortName: 'T1', region: 'LCK', roster: [], budget: 0, salaryCap: 400000, reputation: 80, playStyle: 'controlled' },
          { id: 'lck_GEN', name: 'GEN', shortName: 'GEN', region: 'LCK', roster: [], budget: 0, salaryCap: 400000, reputation: 79, playStyle: 'controlled' },
        ],
        pendingUserMatch: {
          id: 'match-1',
          seasonId: 1,
          week: 1,
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

    expect(await screen.findByRole('heading', { name: '훈련 관리' })).toBeInTheDocument();
    expect(screen.getByText(/2026-03-03 vs GEN/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '경기 준비로 돌아가기' })).toBeInTheDocument();
    expect(screen.getByTestId('training-season-strip')).toBeInTheDocument();
    expect(screen.getByText('시즌 훈련 방향')).toBeInTheDocument();
    expect(screen.getByText('최근 누적 변화량')).toBeInTheDocument();

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
