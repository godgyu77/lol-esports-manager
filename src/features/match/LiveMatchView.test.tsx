import { renderWithProviders, resetStores, screen } from '../../test/testUtils';
import { LiveMatchView } from './LiveMatchView';
import type { Match, Team, GameSave } from '../../types';
import type { Season } from '../../types/game';

vi.mock('../../hooks/useBgm', () => ({ useBgm: vi.fn() }));
vi.mock('../../ai/gameAiService', () => ({ generatePostMatchComment: vi.fn().mockResolvedValue(null) }));
vi.mock('../../ai/advancedAiService', () => ({ generateLiveChatMessages: vi.fn().mockResolvedValue([]) }));
vi.mock('../../engine/match/broadcastLineupEngine', () => ({
  selectBroadcastCrew: vi.fn().mockReturnValue({
    caster: { name: '전용준' },
    analystPrimary: { name: '이현우' },
    analystSecondary: { name: '임주완' },
    announcer: { name: '윤수빈' },
    guestAnalyst: null,
  }),
}));
vi.mock('../../engine/news/newsEngine', () => ({
  generateMatchResultNews: vi.fn().mockResolvedValue(undefined),
  generateInterviewNews: vi.fn().mockResolvedValue(undefined),
  generateSocialMediaReaction: vi.fn().mockResolvedValue(undefined),
  generateFanReactionNews: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../db/queries', () => ({
  getPlayersByTeamId: vi.fn().mockResolvedValue([]),
  getTraitsByTeamId: vi.fn().mockResolvedValue({}),
  getFormByTeamId: vi.fn().mockResolvedValue({}),
  getTeamPlayStyle: vi.fn().mockResolvedValue('standard'),
}));
vi.mock('../../engine/match/teamRating', () => ({ buildLineup: vi.fn().mockReturnValue(null) }));
vi.mock('../../engine/match/liveMatch', () => ({ LiveMatchEngine: vi.fn() }));
vi.mock('../../engine/chemistry/chemistryEngine', () => ({ calculateChemistryBonus: vi.fn().mockResolvedValue(0) }));
vi.mock('../../engine/soloRank/soloRankEngine', () => ({ calculateTeamSoloRankBonus: vi.fn().mockResolvedValue(0) }));
vi.mock('../../engine/season/dayAdvancer', () => ({ saveUserMatchResult: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../engine/season/playoffGenerator', () => ({ processPlayoffMatchResult: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../engine/tournament/tournamentEngine', () => ({ processTournamentMatchResult: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../engine/draft/draftEngine', () => ({ accumulateFearlessChampions: vi.fn().mockReturnValue({ blue: [], red: [] }) }));
vi.mock('./DecisionPopup', () => ({ DecisionPopup: () => <div>DecisionPopup</div> }));
vi.mock('./SeriesResult', () => ({ SeriesResult: () => <div>SeriesResult</div> }));
vi.mock('./TacticsPanel', () => ({ TacticsPanel: () => <div>TacticsPanel</div> }));
vi.mock('./BroadcastHud', () => ({ BroadcastHud: () => <div>BroadcastHud</div> }));
vi.mock('./match.css', () => ({}));

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
  week: 1,
  teamHomeId: 'team-home',
  teamAwayId: 'team-away',
  date: '2025-01-15',
  matchType: 'regular',
  boFormat: 'Bo3',
  scoreHome: 0,
  scoreAway: 0,
  isPlayed: false,
  games: [],
} as unknown as Match;

const mockTeams: Team[] = [
  { id: 'team-home', name: 'T1', shortName: 'T1', region: 'LCK', players: [] } as unknown as Team,
  { id: 'team-away', name: 'Gen.G', shortName: 'GEN', region: 'LCK', players: [] } as unknown as Team,
];

describe('LiveMatchView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('shows a draft gate when the next game still requires banpick', () => {
    renderWithProviders(<LiveMatchView />, {
      gameState: {
        save: mockSave,
        teams: mockTeams,
        pendingUserMatch: mockPendingMatch,
        draftResult: null,
        mode: 'manager',
        fearlessPool: { blue: [], red: [] },
        season: { id: 1, year: 2025, split: 'spring', currentDate: '2025-01-15', currentWeek: 3 } as unknown as Season,
      },
      matchState: {
        speed: 1,
        seriesScore: { home: 1, away: 0 },
        currentGameNum: 2,
        currentGameDraftRequired: true,
        boFormat: 'Bo3',
      },
    });

    expect(screen.getByText('드래프트가 먼저 필요합니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '밴픽 화면으로 이동' })).toBeInTheDocument();
  });
});
