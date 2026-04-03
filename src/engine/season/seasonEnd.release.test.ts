import { beforeEach, describe, expect, it, vi } from 'vitest';

const getStandingsMock = vi.fn();
const getAllPlayersMock = vi.fn();
const getPlayerAverageFormMock = vi.fn();
const updatePlayerStatsMock = vi.fn();
const incrementAllPlayerAgesMock = vi.fn();
const deactivateSeasonMock = vi.fn();
const createSeasonMock = vi.fn();
const getTeamsByRegionMock = vi.fn();
const insertMatchMock = vi.fn();
const startOffseasonMock = vi.fn();
const withTransactionMock = vi.fn(async (callback: () => Promise<unknown>) => callback());

vi.mock('../../db/queries', () => ({
  getAllPlayers: getAllPlayersMock,
  getStandings: getStandingsMock,
  getPlayerAverageForm: getPlayerAverageFormMock,
  updatePlayerStats: updatePlayerStatsMock,
  incrementAllPlayerAges: incrementAllPlayerAgesMock,
  deactivateSeason: deactivateSeasonMock,
  createSeason: createSeasonMock,
  getTeamsByRegion: getTeamsByRegionMock,
  insertMatch: insertMatchMock,
  updateSeasonDate: vi.fn(),
}));

vi.mock('../../db/database', () => ({
  withTransaction: withTransactionMock,
}));

vi.mock('../player/playerGrowth', () => ({
  calculateTeamGrowth: vi.fn(() => []),
}));

vi.mock('./scheduleGenerator', () => ({
  generateLeagueSchedule: vi.fn(() => [
    { week: 1, homeTeamId: 'team_a', awayTeamId: 'team_b' },
  ]),
}));

vi.mock('./calendar', () => ({
  assignMatchDates: vi.fn(() => [
    { week: 1, homeTeamId: 'team_a', awayTeamId: 'team_b', date: '2027-01-10' },
  ]),
  SEASON_DATES: {
    spring: { start: '2026-01-10' },
    summer: { start: '2026-06-10' },
  },
  addDays: vi.fn((date: string) => date),
}));

vi.mock('./playoffGenerator', () => ({
  generatePlayoffSchedule: vi.fn(),
}));

vi.mock('../chemistry/chemistryEngine', () => ({
  initializeTeamChemistry: vi.fn(),
}));

vi.mock('../playerGoal/playerGoalEngine', () => ({
  generatePlayerGoals: vi.fn(),
  checkGoalAchievement: vi.fn(),
}));

vi.mock('../economy/transferEngine', () => ({
  processExpiredContracts: vi.fn(async () => []),
}));

vi.mock('../tournament/tournamentEngine', () => ({
  generateMSI: vi.fn(async () => 'msi'),
  generateWorlds: vi.fn(async () => 'worlds'),
  generateEWC: vi.fn(async () => 'ewc'),
  generateLCKCup: vi.fn(async () => 'lck_cup'),
  generateFST: vi.fn(async () => 'fst'),
  getWorldsQualifiedTeams: vi.fn(async () => []),
}));

vi.mock('../award/awardEngine', () => ({
  calculateSeasonAwards: vi.fn(),
}));

vi.mock('../records/recordsEngine', () => ({
  saveSeasonRecord: vi.fn(),
  addHallOfFameEntry: vi.fn(),
  checkAndInductHallOfFame: vi.fn(),
}));

vi.mock('../retirement/retirementEngine', () => ({
  checkRetirementCandidates: vi.fn(async () => []),
}));

vi.mock('./offseasonEngine', () => ({
  startOffseason: startOffseasonMock,
}));

vi.mock('../board/ownershipEngine', () => ({
  checkOwnershipChange: vi.fn(),
}));

vi.mock('../board/boardEngine', () => ({
  getBoardExpectations: vi.fn(async () => null),
}));

vi.mock('../achievement/achievementEngine', () => ({
  buildAchievementContext: vi.fn(async () => ({ trophyCount: 0, seasonsPlayed: 1 })),
  checkAndUnlockAchievements: vi.fn(),
}));

describe('seasonEnd release gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStandingsMock.mockResolvedValue([
      { teamId: 'team_a', wins: 10, losses: 2, setWins: 22, setLosses: 8 },
      { teamId: 'team_b', wins: 8, losses: 4, setWins: 18, setLosses: 11 },
    ]);
    getAllPlayersMock.mockResolvedValue([]);
    getPlayerAverageFormMock.mockResolvedValue(50);
    createSeasonMock.mockResolvedValue(2027);
    getTeamsByRegionMock.mockResolvedValue([
      { id: 'team_a', name: 'Alpha' },
      { id: 'team_b', name: 'Beta' },
    ]);
  });

  it('creates the next season and opens offseason after a full season end', async () => {
    const { processFullSeasonEnd } = await import('./seasonEnd');

    const result = await processFullSeasonEnd(
      {
        id: 101,
        year: 2026,
        split: 'summer',
        currentWeek: 20,
        currentDate: '2026-09-15',
        startDate: '2026-06-10',
        endDate: '2026-09-20',
        isActive: true,
      },
      'team_a',
      9,
      'team_a',
    );

    expect(result.nextSeasonId).toBe(2027);
    expect(result.nextYear).toBe(2027);
    expect(result.nextSplit).toBe('spring');
    expect(createSeasonMock).toHaveBeenCalledWith(2027, 'spring');
    expect(startOffseasonMock).toHaveBeenCalled();
    expect(insertMatchMock).toHaveBeenCalled();
  });
});
