import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { TeamHistoryView } from './TeamHistoryView';

const {
  mockSelect,
  mockBuildTeamLegacyReport,
  mockGetTeamHistoryLedger,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockBuildTeamLegacyReport: vi.fn(),
  mockGetTeamHistoryLedger: vi.fn(),
}));

vi.mock('../../../db/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    select: mockSelect,
  }),
}));

vi.mock('../../../engine/manager/franchiseNarrativeEngine', () => ({
  buildTeamLegacyReport: mockBuildTeamLegacyReport,
}));

vi.mock('../../../engine/manager/releaseDepthEngine', () => ({
  getTeamHistoryLedger: mockGetTeamHistoryLedger,
}));

describe('TeamHistoryView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    mockSelect
      .mockResolvedValueOnce([
        {
          season_id: 1,
          final_standing: 1,
          wins: 15,
          losses: 3,
          playoff_result: 'Champion',
          champion: 1,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          name: 'Faker',
          position: 'mid',
          total_games: 200,
          total_kills: 900,
        },
      ]);

    mockBuildTeamLegacyReport.mockReturnValue({
      identity: 'LCK title standard bearer',
      internationalPosture: 'International pressure is now real.',
      timelineHook: 'A generation shift is live.',
      replayHooks: ['Hook one', 'Hook two', 'Hook three'],
    });

    mockGetTeamHistoryLedger.mockResolvedValue([
      {
        id: 1,
        teamId: 'lck_T1',
        seasonId: 0,
        ledgerType: 'rivalry_record',
        subjectId: null,
        subjectName: 'Gen.G',
        opponentTeamId: 'lck_GEN',
        statValue: 3,
        secondaryValue: 1,
        note: 'Regional rivalry series updated. Latest meeting: 2-1.',
        extra: ['rivalry'],
        updatedAt: '2026-03-01',
      },
      {
        id: 2,
        teamId: 'lck_T1',
        seasonId: 1,
        ledgerType: 'franchise_icon',
        subjectId: 'p1',
        subjectName: 'Faker',
        opponentTeamId: null,
        statValue: 0,
        secondaryValue: 0,
        note: 'Current franchise face.',
        extra: ['mid'],
        updatedAt: '2026-03-01',
      },
    ]);
  });

  it('renders rivalry and lineage ledger cards', async () => {
    renderWithProviders(<TeamHistoryView />, {
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
          saveName: 'History Test',
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
          {
            id: 'lck_T1',
            name: 'T1',
            shortName: 'T1',
            region: 'LCK',
            budget: 500000,
            salaryCap: 400000,
            reputation: 90,
            roster: [],
            playStyle: 'controlled',
          },
        ],
      },
    });

    expect(await screen.findByText('T1')).toBeInTheDocument();
    expect(screen.getByText('Gen.G')).toBeInTheDocument();
    expect(screen.getByText('Regional rivalry series updated. Latest meeting: 2-1.')).toBeInTheDocument();
    expect(screen.getAllByText('Faker').length).toBeGreaterThan(0);
    expect(mockGetTeamHistoryLedger).toHaveBeenCalledWith('lck_T1', undefined, 24);
  });
});
