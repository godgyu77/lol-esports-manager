import { renderWithProviders, screen, resetStores } from '../../test/testUtils';
import { DraftView } from './DraftView';
import type { Match, Team, GameSave } from '../../types';

// 외부 의존성 모킹
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

// 드래프트 엔진 — 핵심 함수만 모킹
vi.mock('../../engine/draft/draftEngine', () => ({
  createDraftState: vi.fn().mockReturnValue({
    phase: 'ban',
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
    top: null, jungle: null, mid: null, adc: null, support: null,
  }),
  getRecommendedBans: vi.fn().mockReturnValue([]),
  getRecommendedPicks: vi.fn().mockReturnValue([]),
}));

// 자식 컴포넌트 스텁
vi.mock('./BanSection', () => ({
  BanSection: () => <div data-testid="ban-section">BanSection</div>,
}));
vi.mock('./PickSection', () => ({
  PickSection: ({ color }: { color: string }) => <div data-testid={`pick-section-${color}`}>PickSection</div>,
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
  managerName: '테스트 감독',
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

  it('pendingMatch가 없으면 로딩 메시지를 표시한다', () => {
    renderWithProviders(<DraftView />, {
      gameState: { save: mockSave, teams: mockTeams, mode: 'manager' },
    });

    expect(screen.getByText('밴픽 데이터 로딩 중...')).toBeInTheDocument();
  });

  it('pendingMatch가 있으면 드래프트 UI를 렌더한다', async () => {
    renderWithProviders(<DraftView />, {
      gameState: {
        save: mockSave,
        teams: mockTeams,
        pendingUserMatch: mockPendingMatch,
        mode: 'manager',
        fearlessPool: { blue: [], red: [] },
      },
    });

    // 초기화 후 UI 렌더 확인
    expect(await screen.findByText('블루')).toBeInTheDocument();
    expect(screen.getByText('레드')).toBeInTheDocument();
    expect(screen.getByText('VS')).toBeInTheDocument();
    expect(screen.getByText('T1')).toBeInTheDocument();
    expect(screen.getByText('GEN')).toBeInTheDocument();
  });

  it('유저팀(블루)에 YOU 배지를 표시한다', async () => {
    renderWithProviders(<DraftView />, {
      gameState: {
        save: mockSave,
        teams: mockTeams,
        pendingUserMatch: mockPendingMatch,
        mode: 'manager',
        fearlessPool: { blue: [], red: [] },
      },
    });

    expect(await screen.findByText('YOU')).toBeInTheDocument();
  });

  it('밴/픽 섹션과 중앙 패널이 렌더된다', async () => {
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
