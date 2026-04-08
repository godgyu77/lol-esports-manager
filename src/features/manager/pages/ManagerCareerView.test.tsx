import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { ManagerCareerView } from './ManagerCareerView';

const {
  mockGetManagerCareer,
  mockCheckManagerFameEligibility,
  mockGetCareerSummary,
  mockGetCareerArcEvents,
  mockBuildCareerNarrativeReport,
} = vi.hoisted(() => ({
  mockGetManagerCareer: vi.fn(),
  mockCheckManagerFameEligibility: vi.fn(),
  mockGetCareerSummary: vi.fn(),
  mockGetCareerArcEvents: vi.fn(),
  mockBuildCareerNarrativeReport: vi.fn(),
}));

vi.mock('../../../engine/manager/managerCareerEngine', () => ({
  getManagerCareer: mockGetManagerCareer,
  checkManagerFameEligibility: mockCheckManagerFameEligibility,
  getCareerSummary: mockGetCareerSummary,
}));

vi.mock('../../../engine/manager/releaseDepthEngine', () => ({
  getCareerArcEvents: mockGetCareerArcEvents,
}));

vi.mock('../../../engine/manager/franchiseNarrativeEngine', () => ({
  buildCareerNarrativeReport: mockBuildCareerNarrativeReport,
}));

describe('ManagerCareerView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    mockGetManagerCareer.mockResolvedValue([
      {
        seasonId: 1,
        teamId: 'lck_T1',
        teamName: 'T1',
        year: 2026,
        split: 'spring',
        wins: 12,
        losses: 6,
        standing: 2,
        playoffResult: 'Final',
        trophies: [],
        wasFired: false,
      },
    ]);
    mockGetCareerSummary.mockResolvedValue({
      totalSeasons: 1,
      totalWins: 12,
      totalLosses: 6,
      winRate: 66.7,
      totalTrophies: 0,
      trophyList: [],
      teamsManaged: ['T1'],
      bestStanding: 2,
      worstStanding: 2,
      longestTenure: { teamName: 'T1', seasons: 1 },
      firingCount: 0,
      playoffAppearances: 1,
      reputationScore: 64,
      winRateTrend: [],
      standingTrend: [],
    });
    mockCheckManagerFameEligibility.mockResolvedValue({
      eligible: false,
      totalTrophies: 0,
      totalSeasons: 1,
      reason: 'not yet',
    });
    mockBuildCareerNarrativeReport.mockReturnValue({
      identity: 'Dynasty architect',
      outlook: '1 seasons, rising trajectory',
      pillars: ['Longer arc is forming', 'Playoff habit emerging', 'Replay value rising'],
    });
    mockGetCareerArcEvents.mockResolvedValue([
      {
        id: 1,
        saveId: 1,
        teamId: 'lck_T1',
        seasonId: 1,
        arcType: 'rebuild',
        stage: 'emerging',
        startedAt: '2026-03-01',
        resolvedAt: null,
        headline: 'T1 is showing signs of a real rebuild',
        summary: 'The club is no longer treading water.',
        consequences: ['young core rising', 'identity stabilizing'],
      },
    ]);
  });

  it('renders franchise arc timeline entries', async () => {
    renderWithProviders(<ManagerCareerView />, {
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
          saveName: 'Career Test',
          playTimeMinutes: 0,
        },
      },
    });

    expect(await screen.findByText('T1 is showing signs of a real rebuild')).toBeInTheDocument();
    expect(screen.getByText('young core rising')).toBeInTheDocument();
    expect(mockGetCareerArcEvents).toHaveBeenCalledWith(1, 'lck_T1', 6);
  });
});
