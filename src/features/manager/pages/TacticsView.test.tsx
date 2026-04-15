import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { TacticsView } from './TacticsView';

const {
  mockGetTeamTactics,
  mockGenerateInitialCoachRecommendations,
  mockGetPrepRecommendationRecords,
} = vi.hoisted(() => ({
  mockGetTeamTactics: vi.fn(),
  mockGenerateInitialCoachRecommendations: vi.fn(),
  mockGetPrepRecommendationRecords: vi.fn(),
}));

vi.mock('../../../engine/tactics/tacticsEngine', () => ({
  getTeamTactics: mockGetTeamTactics,
  setTeamTactics: vi.fn().mockResolvedValue(undefined),
  createDefaultTactics: vi.fn((teamId: string) => ({
    teamId,
    earlyStrategy: 'standard',
    midStrategy: 'balanced',
    lateStrategy: 'teamfight',
    wardPriority: 'balanced',
    dragonPriority: 5,
    baronPriority: 5,
    aggressionLevel: 5,
  })),
  calculateTacticsBonus: vi.fn().mockReturnValue({
    earlyBonus: 0.02,
    midBonus: 0.01,
    lateBonus: 0.03,
    objectiveBonus: 0.02,
    offense: 2,
    defense: 1,
    objective: 2,
  }),
}));

vi.mock('../../../ai/advancedAiService', () => ({
  generateTacticalSuggestion: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../engine/manager/managerSetupEngine', () => ({
  applyCoachTacticsRecommendation: vi.fn().mockResolvedValue(undefined),
  generateInitialCoachRecommendations: mockGenerateInitialCoachRecommendations,
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getPrepRecommendationRecords: mockGetPrepRecommendationRecords,
  recordPrepRecommendation: vi.fn().mockResolvedValue(undefined),
}));

describe('TacticsView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetTeamTactics.mockResolvedValue({
      teamId: 'lck_T1',
      earlyStrategy: 'standard',
      midStrategy: 'objective_control',
      lateStrategy: 'teamfight',
      wardPriority: 'balanced',
      dragonPriority: 7,
      baronPriority: 6,
      aggressionLevel: 5,
    });
    mockGenerateInitialCoachRecommendations.mockResolvedValue([]);
    mockGetPrepRecommendationRecords.mockResolvedValue([]);
  });

  it('renders the main loop summary and season tactics strip with next match context', async () => {
    renderWithProviders(<TacticsView />, {
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
        teams: [
          { id: 'lck_T1', name: 'T1', shortName: 'T1', region: 'LCK', roster: [], budget: 0, salaryCap: 400000, reputation: 80, playStyle: 'controlled' },
          { id: 'lck_GEN', name: 'Gen.G', shortName: 'GEN', region: 'LCK', roster: [], budget: 0, salaryCap: 400000, reputation: 79, playStyle: 'controlled' },
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

    expect(await screen.findByRole('heading', { name: '전술 관리' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI 코치' })).toBeInTheDocument();
    expect(screen.getByText(/2026-03-03 vs Gen\.G/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '경기 준비로 복귀' })).toBeInTheDocument();
    expect(screen.getByTestId('tactics-season-strip')).toBeInTheDocument();
    expect(screen.getByText('시즌 전술 방향')).toBeInTheDocument();
    expect(screen.getByText('누적 준비 검증')).toBeInTheDocument();
  });
});
