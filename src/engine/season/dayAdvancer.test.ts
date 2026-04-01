import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDatabaseMock = vi.fn();
const updateMatchResultMock = vi.fn();
const insertGameResultMock = vi.fn();
const insertPlayerGameStatsMock = vi.fn();
const upsertPlayerCareerStatsMock = vi.fn();
const insertPlayerFormHistoryMock = vi.fn();
const adjustPlayerChemistryMock = vi.fn();
const getPlayersByTeamIdMock = vi.fn();

vi.mock('../../db/database', () => ({
  getDatabase: getDatabaseMock,
}));

vi.mock('../../db/queries', () => ({
  getAllPlayersGroupedByTeam: vi.fn(),
  getMatchesByDate: vi.fn(),
  getPlayersByTeamId: getPlayersByTeamIdMock,
  getTraitsByTeamId: vi.fn(),
  getFormByTeamId: vi.fn(),
  getTeamPlayStyle: vi.fn(),
  updateMatchResult: updateMatchResultMock,
  updateSeasonDate: vi.fn(),
  getTeamConditions: vi.fn(),
  batchUpsertPlayerConditions: vi.fn(),
  insertDailyEvent: vi.fn(),
  insertGameResult: insertGameResultMock,
  insertPlayerGameStats: insertPlayerGameStatsMock,
  getActiveSeason: vi.fn(),
  upsertPlayerCareerStats: upsertPlayerCareerStatsMock,
  insertPlayerFormHistory: insertPlayerFormHistoryMock,
  adjustPlayerChemistry: adjustPlayerChemistryMock,
}));

vi.mock('../match/teamRating', () => ({
  buildLineup: vi.fn(),
}));

vi.mock('../match/matchSimulator', () => ({
  simulateMatch: vi.fn(),
}));

vi.mock('./calendar', () => ({
  parseDate: vi.fn(),
  addDays: vi.fn(),
  getDayName: vi.fn(),
}));

vi.mock('../tactics/tacticsEngine', () => ({
  getTeamTactics: vi.fn(),
  calculateTacticsBonus: vi.fn(),
}));

vi.mock('./playoffGenerator', () => ({
  processPlayoffMatchResult: vi.fn(),
}));

vi.mock('../tournament/tournamentEngine', () => ({
  processTournamentMatchResult: vi.fn(),
}));

vi.mock('../scouting/scoutingEngine', () => ({
  advanceScoutingDay: vi.fn(),
}));

vi.mock('../news/newsEngine', () => ({
  generateMatchResultNews: vi.fn(),
  generateInjuryNews: vi.fn(),
}));

vi.mock('../board/boardEngine', () => ({
  processMatchResult: vi.fn(),
  checkFiringRisk: vi.fn(),
}));

vi.mock('../academy/academyEngine', () => ({
  advanceAcademyDay: vi.fn(),
}));

vi.mock('../injury/injuryEngine', () => ({
  checkForInjuries: vi.fn(),
  advanceInjuryDay: vi.fn(),
  getInjuredPlayerIds: vi.fn(),
  formatInjuryEvent: vi.fn(),
  getInjuryDebuff: vi.fn(),
}));

vi.mock('./offseasonEngine', () => ({
  isInOffseason: vi.fn(),
  advanceOffseasonDay: vi.fn(),
  getCurrentOffseasonState: vi.fn(),
  OFFSEASON_PHASE_LABELS: {},
}));

vi.mock('./preseasonEngine', () => ({
  processBootcampDay: vi.fn(),
}));

vi.mock('../mentoring/mentoringEngine', () => ({
  processMentoringDay: vi.fn(),
}));

vi.mock('../soloRank/soloRankEngine', () => ({
  processTeamSoloRank: vi.fn(),
  calculateTeamSoloRankBonus: vi.fn(),
}));

vi.mock('../chemistry/chemistryEngine', () => ({
  processTeamChemistryDay: vi.fn(),
  calculateChemistryBonus: vi.fn(),
}));

vi.mock('../difficulty/difficultyEngine', () => ({
  getDifficultyModifiers: vi.fn(),
}));

vi.mock('../event/playerEventEngine', () => ({
  generateDailyPlayerEvents: vi.fn(),
  processPlayerEvent: vi.fn(),
}));

vi.mock('../../utils/mathUtils', () => ({
  clamp: vi.fn(),
}));

vi.mock('../../utils/random', () => ({
  initGlobalRng: vi.fn(),
  getBaseSeed: vi.fn(),
  randomInt: vi.fn(),
}));

vi.mock('../training/trainingEngine', () => ({
  getTrainingScheduleEntry: vi.fn(),
}));

vi.mock('../manager/managerInterventionEngine', () => ({
  getActiveInterventionEffects: vi.fn(),
}));

vi.mock('../manager/managerIdentityEngine', () => ({
  getManagerIdentity: vi.fn(),
  getManagerIdentityEffects: vi.fn(),
}));

vi.mock('./dayAdvancerTasks', () => ({
  processNonMatchDay: vi.fn(),
  processWeeklyTasks: vi.fn(),
  processMonthlyTasks: vi.fn(),
  processSeasonTransition: vi.fn(),
}));

describe('dayAdvancer.saveUserMatchResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDatabaseMock.mockResolvedValue({
      execute: vi.fn(async () => ({ lastInsertId: 1 })),
    });
    getPlayersByTeamIdMock.mockResolvedValue([
      { id: 'home-top' },
      { id: 'home-jg' },
    ]);
  });

  it('stores damage totals with the real match date and normalized chemistry updates', async () => {
    const { saveUserMatchResult } = await import('./dayAdvancer');

    await saveUserMatchResult(
      {
        id: 'match-1',
        teamHomeId: 'team-home',
        teamAwayId: 'team-away',
        matchDate: '2026-02-14',
      } as never,
      {
        winner: 'home',
        scoreHome: 2,
        scoreAway: 0,
        games: [
          {
            winnerSide: 'home',
            durationMinutes: 30,
            goldDiffAt15: 1500,
            killsHome: 12,
            killsAway: 4,
            playerStatsHome: [
              {
                playerId: 'home-top',
                position: 'top',
                kills: 5,
                deaths: 1,
                assists: 6,
                cs: 300,
                goldEarned: 12000,
                damageDealt: 28000,
              },
              {
                playerId: 'home-jg',
                position: 'jungle',
                kills: 2,
                deaths: 2,
                assists: 8,
                cs: 180,
                goldEarned: 9000,
                damageDealt: 14000,
              },
            ],
            playerStatsAway: [
              {
                playerId: 'away-mid',
                position: 'mid',
                kills: 1,
                deaths: 5,
                assists: 2,
                cs: 250,
                goldEarned: 8000,
                damageDealt: 11000,
              },
            ],
          },
        ],
      } as never,
    );

    expect(upsertPlayerCareerStatsMock).toHaveBeenCalledWith(
      'home-top',
      'team-home',
      expect.objectContaining({ damage: 28000 }),
    );
    expect(upsertPlayerCareerStatsMock).toHaveBeenCalledWith(
      'away-mid',
      'team-away',
      expect.objectContaining({ damage: 11000 }),
    );
    expect(insertPlayerFormHistoryMock).toHaveBeenCalledWith(
      'home-top',
      '2026-02-14',
      expect.any(Number),
    );
    expect(insertPlayerFormHistoryMock).toHaveBeenCalledWith(
      'away-mid',
      '2026-02-14',
      expect.any(Number),
    );
    expect(adjustPlayerChemistryMock).toHaveBeenCalledWith('home-top', 'home-jg', 1);
  });
});
