import { renderWithProviders, screen } from '../../test/testUtils';
import { PostGameStats } from './PostGameStats';
import type { GameResult } from '../../engine/match/matchSimulator';
import type { PostMatchInsightReport } from '../../engine/analysis/postMatchInsightEngine';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createGameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    winnerSide: 'home',
    durationMinutes: 30,
    goldDiffAt15: 1200,
    killsHome: 15,
    killsAway: 9,
    goldHome: 62000,
    goldAway: 55000,
    towersHome: 8,
    towersAway: 3,
    events: [],
    playerStatsHome: [
      { playerId: 'h1', position: 'top', kills: 3, deaths: 2, assists: 5, cs: 210, goldEarned: 12000, damageDealt: 18000 },
      { playerId: 'h2', position: 'jungle', kills: 2, deaths: 1, assists: 9, cs: 170, goldEarned: 11000, damageDealt: 12000 },
      { playerId: 'h3', position: 'mid', kills: 4, deaths: 2, assists: 6, cs: 250, goldEarned: 13000, damageDealt: 20000 },
      { playerId: 'h4', position: 'adc', kills: 5, deaths: 1, assists: 4, cs: 300, goldEarned: 15000, damageDealt: 23000 },
      { playerId: 'h5', position: 'support', kills: 1, deaths: 3, assists: 10, cs: 45, goldEarned: 8000, damageDealt: 6000 },
    ],
    playerStatsAway: [
      { playerId: 'a1', position: 'top', kills: 1, deaths: 4, assists: 3, cs: 190, goldEarned: 9500, damageDealt: 10000 },
      { playerId: 'a2', position: 'jungle', kills: 2, deaths: 4, assists: 4, cs: 160, goldEarned: 9800, damageDealt: 9000 },
      { playerId: 'a3', position: 'mid', kills: 3, deaths: 3, assists: 2, cs: 230, goldEarned: 10200, damageDealt: 15000 },
      { playerId: 'a4', position: 'adc', kills: 3, deaths: 2, assists: 2, cs: 280, goldEarned: 11500, damageDealt: 17000 },
      { playerId: 'a5', position: 'support', kills: 0, deaths: 2, assists: 6, cs: 38, goldEarned: 7000, damageDealt: 5000 },
    ],
    dragonSoul: {
      homeStacks: 2,
      awayStacks: 1,
      dragonTypes: [
        { type: 'infernal', side: 'home' },
        { type: 'ocean', side: 'home' },
        { type: 'mountain', side: 'away' },
      ],
    },
    grubsHome: 4,
    grubsAway: 2,
    goldHistory: [
      { tick: 900, diff: 1200 },
      { tick: 1800, diff: 7000 },
    ],
    ...overrides,
  };
}

const insightReport: PostMatchInsightReport = {
  headline: '경기 뒤 전술 정리가 필요합니다.',
  outcomeLabel: '핵심 사인',
  reasons: [],
  recommendedActions: ['전술 재검토'],
  followUps: [
    {
      action: '전술 재검토',
      priority: 'high',
      summary: '라인 우선순위와 진입 타이밍을 다시 확인하세요.',
    },
    {
      action: '훈련 조정',
      priority: 'medium',
      summary: '다음 경기 전 교전 훈련을 보강하세요.',
    },
  ],
};

describe('PostGameStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes follow-up CTA buttons to the relevant manager screens', async () => {
    const { user } = renderWithProviders(
      <PostGameStats
        gameResult={createGameResult()}
        homeTeamName="T1"
        awayTeamName="GEN"
        gameNumber={1}
        insightReport={insightReport}
      />,
    );

    expect(screen.getByTestId('postgame-followup-action-0')).toBeInTheDocument();
    expect(screen.getByTestId('postgame-followup-action-1')).toBeInTheDocument();

    await user.click(screen.getByTestId('postgame-followup-action-0'));
    expect(mockNavigate).toHaveBeenCalledWith('/manager/tactics');

    await user.click(screen.getByTestId('postgame-followup-action-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/manager/training');
  });

  it('shows emotional, signature, and player spotlight cards before detailed follow-ups', () => {
    renderWithProviders(
      <PostGameStats
        gameResult={createGameResult()}
        homeTeamName="T1"
        awayTeamName="GEN"
        gameNumber={1}
        insightReport={insightReport}
      />,
    );

    expect(screen.getByTestId('postgame-emotion-card')).toBeInTheDocument();
    expect(screen.getByTestId('postgame-signature-card')).toBeInTheDocument();
    expect(screen.getByTestId('postgame-player-spotlight-card')).toBeInTheDocument();
    expect(screen.getAllByText('시리즈의 얼굴').length).toBeGreaterThanOrEqual(1);
  });
});
