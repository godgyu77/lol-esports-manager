import { renderWithProviders, resetStores, screen } from '../../test/testUtils';
import { DraftView } from './DraftView';
import type { GameSave, Match, Team } from '../../types';

vi.mock('../../hooks/useBgm', () => ({
  useBgm: vi.fn(),
}));

vi.mock('../../audio/soundManager', () => ({
  soundManager: { play: vi.fn(), stop: vi.fn(), setEnabled: vi.fn(), setVolume: vi.fn() },
}));

vi.mock('../../ai/advancedAiService', () => ({
  generateDraftAdvice: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../db/queries', () => ({
  getPlayersByTeamId: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../engine/draft/draftEngine', () => ({
  createDraftState: vi.fn().mockReturnValue({
    phase: 'ban1',
    currentStep: 0,
    currentSide: 'blue',
    currentActionType: 'ban',
    isComplete: false,
    blue: { bans: [], picks: [] },
    red: { bans: [], picks: [] },
    bannedChampions: [],
    pickedChampions: [],
    fearlessMode: false,
    fearlessPool: { blue: [], red: [] },
  }),
  executeDraftAction: vi.fn().mockReturnValue(true),
  swapChampions: vi.fn(),
  finalizeDraft: vi.fn(),
  aiSelectBan: vi.fn().mockResolvedValue('champion_1'),
  aiSelectPick: vi.fn().mockResolvedValue({ championId: 'champion_1', position: 'mid' }),
  buildDraftTeamInfo: vi.fn().mockReturnValue({
    playerPools: { top: [], jungle: [], mid: [], adc: [], support: [] },
    preferredTags: [],
  }),
  getRecommendedBans: vi.fn().mockReturnValue([]),
  getRecommendedPicks: vi.fn().mockReturnValue([]),
}));

vi.mock('./BanSection', () => ({
  BanSection: () => <div data-testid="ban-section">BanSection</div>,
}));

vi.mock('./PickSection', () => ({
  PickSection: ({ sideLabel }: { sideLabel: string }) => <div data-testid={`pick-section-${sideLabel}`}>PickSection</div>,
}));

vi.mock('./DraftCenterPanel', () => ({
  DraftCenterPanel: () => <div data-testid="draft-center-panel">DraftCenterPanel</div>,
}));

vi.mock('./ChampionGrid', () => ({
  ChampionGrid: () => <div data-testid="champion-grid">ChampionGrid</div>,
}));

vi.mock('./draft.css', () => ({}));

const mockSave = {
  id: 'save-1',
  userTeamId: 'team-home',
  seasonId: 'season-1',
  currentDate: '2025-01-15',
  managerName: 'Test Manager',
  mode: 'manager',
} as unknown as GameSave;

const mockPendingMatch = {
  id: 'match-1',
  seasonId: 1,
  teamHomeId: 'team-home',
  teamAwayId: 'team-away',
  date: '2025-01-15',
  matchType: 'regular',
  fearlessDraft: false,
  boFormat: 'Bo3',
} as unknown as Match;

const mockTeams: Team[] = [
  { id: 'team-home', name: 'T1', shortName: 'T1', region: 'LCK', players: [] } as unknown as Team,
  { id: 'team-away', name: 'Gen.G', shortName: 'GEN', region: 'LCK', players: [] } as unknown as Team,
];

describe('DraftView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('shows a loading message when there is no pending match', () => {
    renderWithProviders(<DraftView />, {
      gameState: { save: mockSave, teams: mockTeams, mode: 'manager' },
    });

    expect(screen.getByText('밴픽 화면을 준비하는 중입니다...')).toBeInTheDocument();
  });

  it('renders the full draft room shell when a pending match exists', async () => {
    renderWithProviders(<DraftView />, {
      gameState: {
        save: mockSave,
        teams: mockTeams,
        pendingUserMatch: mockPendingMatch,
        mode: 'manager',
        fearlessPool: { blue: [], red: [] },
      },
    });

    expect(await screen.findByText('세트 1 밴픽')).toBeInTheDocument();
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('GEN')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
  });

  it('shows the user badge on the user team header', async () => {
    renderWithProviders(<DraftView />, {
      gameState: {
        save: mockSave,
        teams: mockTeams,
        pendingUserMatch: mockPendingMatch,
        mode: 'manager',
        fearlessPool: { blue: [], red: [] },
      },
    });

    expect(await screen.findByText('내 팀')).toBeInTheDocument();
  });

  it('renders the ban board and center panel', async () => {
    renderWithProviders(<DraftView />, {
      gameState: {
        save: mockSave,
        teams: mockTeams,
        pendingUserMatch: mockPendingMatch,
        mode: 'manager',
        fearlessPool: { blue: [], red: [] },
      },
    });

    expect(await screen.findByTestId('ban-section')).toBeInTheDocument();
    expect(screen.getByTestId('draft-center-panel')).toBeInTheDocument();
  });
});
