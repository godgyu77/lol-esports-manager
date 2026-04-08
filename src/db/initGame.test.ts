import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  state,
  fakeDb,
  mockCreateSeason,
  mockGetTeamsByRegion,
  mockGetAllTeams,
  mockCreateSave,
  mockGetSaveById,
  mockInsertMatch,
  mockInsertPlayer,
  mockInitializeTeamChemistry,
  mockGeneratePlayerGoals,
} = vi.hoisted(() => {
  const state = { inTransaction: false };
  const fakeDb = {
    execute: vi.fn().mockResolvedValue({ lastInsertId: 1 }),
    select: vi.fn().mockImplementation(async (query: string) => {
      if (query.includes('PRAGMA integrity_check')) return [{ integrity_check: 'ok' }];
      if (query.includes("SELECT name FROM sqlite_master")) return [];
      return [];
    }),
  };

  return {
    state,
    fakeDb,
    mockCreateSeason: vi.fn().mockResolvedValue(1),
    mockGetTeamsByRegion: vi.fn().mockImplementation(async (region: string) => {
      if (region === 'LCK') return [{ id: 'lck_T1', name: 'T1' }];
      return [{ id: `${region.toLowerCase()}_team`, name: `${region} Team` }];
    }),
    mockGetAllTeams: vi.fn().mockResolvedValue([{ id: 'lck_T1', name: 'T1' }]),
    mockCreateSave: vi.fn().mockResolvedValue(99),
    mockGetSaveById: vi.fn().mockResolvedValue({
      id: 99,
      metadataId: 99,
      currentSeasonId: 1,
      mode: 'player',
      dbFilename: 'slot1.db',
      rngSeed: 'seed-123',
      saveName: 'T1 2026 Spring',
      seasonInfo: '2026 Spring W1',
    }),
    mockInsertMatch: vi.fn().mockResolvedValue(undefined),
    mockInsertPlayer: vi.fn().mockResolvedValue(undefined),
    mockInitializeTeamChemistry: vi.fn().mockImplementation(async () => {
      if (state.inTransaction) throw new Error('chemistry called inside transaction');
    }),
    mockGeneratePlayerGoals: vi.fn().mockImplementation(async () => {
      if (state.inTransaction) throw new Error('goals called inside transaction');
      return [];
    }),
  };
});

vi.mock('./database', () => ({
  deleteGameDatabase: vi.fn().mockResolvedValue(undefined),
  gameDatabaseExists: vi.fn().mockResolvedValue(false),
  getDatabase: vi.fn().mockResolvedValue(fakeDb),
  getGameDatabaseFileName: vi.fn().mockReturnValue('slot1.db'),
  prepareForDatabaseFileMutation: vi.fn().mockResolvedValue(undefined),
  setActiveGameDatabase: vi.fn().mockResolvedValue(undefined),
  withTransaction: vi.fn(async (fn: (db: typeof fakeDb) => Promise<unknown>) => {
    state.inTransaction = true;
    try {
      return await fn(fakeDb);
    } finally {
      state.inTransaction = false;
    }
  }),
}));

vi.mock('./queries', () => ({
  createSave: (...args: unknown[]) => mockCreateSave(...args),
  createSeason: (...args: unknown[]) => mockCreateSeason(...args),
  getActiveSeason: vi.fn().mockResolvedValue(null),
  getAllPlayersGroupedByTeam: vi.fn(),
  getAllTeams: (...args: unknown[]) => mockGetAllTeams(...args),
  getSaveById: (...args: unknown[]) => mockGetSaveById(...args),
  getTeamsByRegion: (...args: unknown[]) => mockGetTeamsByRegion(...args),
  insertMatch: (...args: unknown[]) => mockInsertMatch(...args),
  insertPlayer: (...args: unknown[]) => mockInsertPlayer(...args),
  updateRngSeed: vi.fn(),
}));

vi.mock('../engine/season/scheduleGenerator', () => ({
  generateLeagueSchedule: vi.fn().mockReturnValue([{ week: 1, homeTeamId: 'lck_T1', awayTeamId: 'lck_T1' }]),
}));

vi.mock('../engine/season/calendar', () => ({
  assignMatchDates: vi.fn().mockReturnValue([{ week: 1, homeTeamId: 'lck_T1', awayTeamId: 'lck_T1', date: '2026-01-01' }]),
  SEASON_DATES: { spring: { start: '2026-01-01' } },
}));

vi.mock('./seed', () => ({
  seedAllData: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/tournament/tournamentEngine', () => ({
  generateLCKCup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/chemistry/chemistryEngine', () => ({
  initializeTeamChemistry: (...args: unknown[]) => mockInitializeTeamChemistry(...args),
}));

vi.mock('../engine/playerGoal/playerGoalEngine', () => ({
  generatePlayerGoals: (...args: unknown[]) => mockGeneratePlayerGoals(...args),
}));

vi.mock('../ai/rag/ragEngine', () => ({
  initializeKnowledgeBase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/random', () => ({
  initGlobalRng: vi.fn(),
}));

vi.mock('../engine/staff/staffEngine', () => ({
  seedAllTeamsStaff: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../engine/manager/managerSetupEngine', () => ({
  ensureInitialCoachBriefingNews: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../stores/gameStore', () => ({
  useGameStore: { getState: vi.fn() },
}));

import { initializeNewGame } from './initGame';

describe('initializeNewGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.inTransaction = false;
    fakeDb.execute.mockResolvedValue({ lastInsertId: 1 });
    fakeDb.select.mockImplementation(async (query: string) => {
      if (query.includes('PRAGMA integrity_check')) return [{ integrity_check: 'ok' }];
      if (query.includes("SELECT name FROM sqlite_master")) return [];
      return [];
    });
    mockCreateSeason.mockResolvedValue(1);
    mockGetAllTeams.mockResolvedValue([{ id: 'lck_T1', name: 'T1' }]);
    mockGetSaveById.mockResolvedValue({
      id: 99,
      metadataId: 99,
      currentSeasonId: 1,
      mode: 'player',
      dbFilename: 'slot1.db',
      rngSeed: 'seed-123',
      saveName: 'T1 2026 Spring',
      seasonInfo: '2026 Spring W1',
    });
  });

  it('runs chemistry and player-goal initialization after the transaction commits', async () => {
    await expect(
      initializeNewGame('player', 'lck_T1', 1, {
        name: 'Rookie',
        age: 18,
        nationality: 'KR',
        position: 'mid',
        background: 'prodigy',
        traits: ['GROWTH_POTENTIAL'],
      }),
    ).resolves.toMatchObject({ metadataId: 99 });

    expect(mockInitializeTeamChemistry).toHaveBeenCalledWith('lck_T1');
    expect(mockGeneratePlayerGoals).toHaveBeenCalledWith('lck_T1', 1);
  });
});
