import { renderWithProviders, screen } from '../../test/testUtils';
import { SeriesResult } from './SeriesResult';
import type { GameResult } from '../../engine/match/matchSimulator';

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

vi.mock('./match.css', () => ({}));

function createGameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    winnerSide: 'away',
    durationMinutes: 33,
    goldDiffAt15: -2600,
    killsHome: 8,
    killsAway: 19,
    goldHome: 54000,
    goldAway: 64200,
    towersHome: 3,
    towersAway: 9,
    events: [
      { tick: 900, type: 'baron', side: 'away', description: 'baron', goldChange: 0 },
      { tick: 1000, type: 'rift_herald', side: 'away', description: 'herald', goldChange: 0 },
    ],
    playerStatsHome: [
      { playerId: 'h1', position: 'top', kills: 1, deaths: 6, assists: 3, cs: 210, goldEarned: 9300, damageDealt: 12000 },
      { playerId: 'h2', position: 'jungle', kills: 2, deaths: 3, assists: 4, cs: 170, goldEarned: 9600, damageDealt: 9000 },
      { playerId: 'h3', position: 'mid', kills: 2, deaths: 4, assists: 3, cs: 250, goldEarned: 11000, damageDealt: 15000 },
      { playerId: 'h4', position: 'adc', kills: 2, deaths: 5, assists: 2, cs: 295, goldEarned: 11800, damageDealt: 17000 },
      { playerId: 'h5', position: 'support', kills: 1, deaths: 4, assists: 6, cs: 38, goldEarned: 7600, damageDealt: 5000 },
    ],
    playerStatsAway: [
      { playerId: 'a1', position: 'top', kills: 3, deaths: 2, assists: 5, cs: 230, goldEarned: 11200, damageDealt: 14500 },
      { playerId: 'a2', position: 'jungle', kills: 4, deaths: 1, assists: 9, cs: 190, goldEarned: 12400, damageDealt: 11000 },
      { playerId: 'a3', position: 'mid', kills: 5, deaths: 1, assists: 6, cs: 270, goldEarned: 13500, damageDealt: 19000 },
      { playerId: 'a4', position: 'adc', kills: 6, deaths: 2, assists: 7, cs: 310, goldEarned: 14200, damageDealt: 23000 },
      { playerId: 'a5', position: 'support', kills: 1, deaths: 2, assists: 13, cs: 40, goldEarned: 8900, damageDealt: 7000 },
    ],
    dragonSoul: {
      homeStacks: 1,
      awayStacks: 2,
      dragonTypes: [
        { type: 'infernal', side: 'away' },
        { type: 'ocean', side: 'away' },
        { type: 'mountain', side: 'home' },
      ],
    },
    grubsHome: 0,
    grubsAway: 6,
    goldHistory: [
      { tick: 900, diff: -2600 },
      { tick: 1980, diff: -10200 },
    ],
    ...overrides,
  };
}

describe('SeriesResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('surfaces the primary follow-up CTA for the player perspective', async () => {
    const { user } = renderWithProviders(
      <SeriesResult
        homeTeamShortName="T1"
        awayTeamShortName="GEN"
        homeTeamName="T1"
        awayTeamName="Gen.G"
        seriesScore={{ home: 0, away: 2 }}
        gameResults={[createGameResult()]}
        perspectiveSide="home"
        onReturn={vi.fn()}
      />,
    );

    expect(screen.getByTestId('series-result-primary-followup')).toBeInTheDocument();

    await user.click(screen.getByTestId('series-result-primary-followup'));

    expect(mockNavigate).toHaveBeenCalledWith('/manager/tactics');
  });

  it('shows emotional, signature, and player story cards for the series', () => {
    renderWithProviders(
      <SeriesResult
        homeTeamShortName="T1"
        awayTeamShortName="GEN"
        homeTeamName="T1"
        awayTeamName="Gen.G"
        seriesScore={{ home: 0, away: 2 }}
        gameResults={[createGameResult()]}
        perspectiveSide="home"
        onReturn={vi.fn()}
      />,
    );

    expect(screen.getByTestId('series-result-emotion-panel')).toBeInTheDocument();
    expect(screen.getByTestId('series-result-signature-card')).toBeInTheDocument();
    expect(screen.getByTestId('series-result-player-story-card')).toBeInTheDocument();
    expect(screen.getAllByText('시리즈의 얼굴').length).toBeGreaterThanOrEqual(1);
  });
});
