import { beforeEach, describe, expect, it, vi } from 'vitest';

const setActiveGameDatabaseMock = vi.fn();
const checkpointActiveGameDatabaseMock = vi.fn();
const closeDatabaseMock = vi.fn();
const copyGameDatabaseMock = vi.fn();
const getDatabaseMock = vi.fn();
const getSaveByIdMock = vi.fn();
const createManualSaveMock = vi.fn();
const updateSaveMetaMock = vi.fn();
const getActiveGameDatabaseNameMock = vi.fn(() => 'slot_1.db');
const useGameStoreGetStateMock = vi.fn();

vi.mock('../../db/database', () => ({
  AUTOSAVE_DATABASE_FILE: 'autosave.db',
  checkpointActiveGameDatabase: checkpointActiveGameDatabaseMock,
  closeDatabase: closeDatabaseMock,
  copyGameDatabase: copyGameDatabaseMock,
  deleteGameDatabase: vi.fn(),
  gameDatabaseExists: vi.fn(async () => true),
  getActiveGameDatabaseName: getActiveGameDatabaseNameMock,
  getDatabase: getDatabaseMock,
  getGameDatabaseFileName: vi.fn((slot: number) => `slot_${slot}.db`),
  setActiveGameDatabase: setActiveGameDatabaseMock,
}));

vi.mock('../../db/queries', () => ({
  createManualSave: createManualSaveMock,
  getAllSaves: vi.fn(),
  getAutoSave: vi.fn(),
  getSaveById: getSaveByIdMock,
  deleteSave: vi.fn(),
  updatePlayTime: vi.fn(),
  updateSaveMeta: updateSaveMetaMock,
}));

vi.mock('../../stores/gameStore', () => ({
  useGameStore: {
    getState: useGameStoreGetStateMock,
  },
}));

vi.mock('../../utils/random', () => ({
  getBaseSeed: vi.fn(() => 'release-seed'),
}));

describe('saveEngine release gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveGameDatabaseNameMock.mockReturnValue('slot_1.db');
    useGameStoreGetStateMock.mockReturnValue({
      save: null,
      season: null,
      teams: [],
      setSave: vi.fn(),
    });
    getDatabaseMock.mockResolvedValue({
      select: vi.fn(async (sql: string) => {
        if (sql.includes('FROM teams WHERE id =')) return [{ id: 'team_1' }];
        if (sql.includes('FROM seasons WHERE id =')) return [{ id: 101 }];
        if (sql.includes('FROM players WHERE id =')) return [{ id: 'player_1' }];
        if (sql.includes('COUNT(*) as cnt FROM players WHERE team_id =')) return [{ cnt: 5 }];
        if (sql.includes('SELECT 1 FROM player_chemistry')) return [{ 1: 1 }];
        if (sql.includes('SELECT 1 FROM player_satisfaction')) return [{ 1: 1 }];
        if (sql.includes('SELECT 1 FROM player_solo_rank')) return [{ 1: 1 }];
        return [];
      }),
    });
  });

  it('loads a save when metadata and DB contents are coherent', async () => {
    getSaveByIdMock.mockResolvedValue({
      id: 1,
      metadataId: 1,
      mode: 'manager',
      userTeamId: 'team_1',
      userPlayerId: 'player_1',
      currentSeasonId: 101,
      dbFilename: 'slot_1.db',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      slotNumber: 1,
      saveName: 'Release smoke',
      playTimeMinutes: 10,
    });

    const { loadSave } = await import('./saveEngine');
    const save = await loadSave(1);

    expect(save.userTeamId).toBe('team_1');
    expect(setActiveGameDatabaseMock).toHaveBeenCalledWith('slot_1.db');
  });

  it('rejects saves that point to an empty team roster', async () => {
    getSaveByIdMock.mockResolvedValue({
      id: 2,
      metadataId: 2,
      mode: 'manager',
      userTeamId: 'team_1',
      currentSeasonId: 101,
      dbFilename: 'slot_2.db',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      slotNumber: 2,
      saveName: 'Broken release smoke',
      playTimeMinutes: 0,
    });
    getDatabaseMock.mockResolvedValue({
      select: vi.fn(async (sql: string) => {
        if (sql.includes('COUNT(*) as cnt FROM players WHERE team_id =')) return [{ cnt: 0 }];
        if (sql.includes('FROM teams WHERE id =')) return [{ id: 'team_1' }];
        if (sql.includes('FROM seasons WHERE id =')) return [{ id: 101 }];
        if (sql.includes('SELECT 1 FROM player_chemistry')) return [{ 1: 1 }];
        if (sql.includes('SELECT 1 FROM player_satisfaction')) return [{ 1: 1 }];
        if (sql.includes('SELECT 1 FROM player_solo_rank')) return [{ 1: 1 }];
        return [];
      }),
    });

    const { loadSave } = await import('./saveEngine');

    await expect(loadSave(2)).rejects.toThrow();
  });

  it('updates metadata in place when saving back into the current slot', async () => {
    useGameStoreGetStateMock.mockReturnValue({
      save: {
        id: 11,
        metadataId: 21,
        mode: 'manager',
        userTeamId: 'team_1',
        currentSeasonId: 101,
        dbFilename: 'slot_1.db',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        slotNumber: 1,
        saveName: 'Current Save',
        playTimeMinutes: 125,
      },
      season: {
        id: 101,
        year: 2026,
        split: 'spring',
        currentWeek: 7,
      },
      teams: [
        { id: 'team_1', name: 'Alpha' },
      ],
      setSave: vi.fn(),
    });

    const { createManualSaveFromCurrent } = await import('./saveEngine');
    const metadataId = await createManualSaveFromCurrent(1, 'Updated Save');

    expect(metadataId).toBe(21);
    expect(updateSaveMetaMock).toHaveBeenCalled();
    expect(copyGameDatabaseMock).not.toHaveBeenCalled();
  });

  it('snapshots the active DB when saving into a different slot', async () => {
    createManualSaveMock.mockResolvedValue(33);
    useGameStoreGetStateMock.mockReturnValue({
      save: {
        id: 12,
        metadataId: 22,
        mode: 'manager',
        userTeamId: 'team_1',
        currentSeasonId: 101,
        dbFilename: 'slot_1.db',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        slotNumber: 1,
        saveName: 'Branch Source',
        playTimeMinutes: 210,
        rngSeed: 'branch-seed',
      },
      season: {
        id: 101,
        year: 2026,
        split: 'spring',
        currentWeek: 9,
      },
      teams: [
        { id: 'team_1', name: 'Alpha' },
      ],
      setSave: vi.fn(),
    });

    const { createManualSaveFromCurrent } = await import('./saveEngine');
    const metadataId = await createManualSaveFromCurrent(2, 'Branch Slot');

    expect(metadataId).toBe(33);
    expect(checkpointActiveGameDatabaseMock).toHaveBeenCalled();
    expect(closeDatabaseMock).toHaveBeenCalled();
    expect(copyGameDatabaseMock).toHaveBeenCalledWith('slot_1.db', 'slot_2.db');
    expect(setActiveGameDatabaseMock).toHaveBeenCalledWith('slot_1.db');
    expect(createManualSaveMock).toHaveBeenCalled();
  });
});
