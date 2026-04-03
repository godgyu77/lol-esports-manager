import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CareerArcType, CareerArcStage, TeamHistoryLedgerType } from '../../types/systemDepth';

type CareerArcRow = {
  id: number;
  save_id: number;
  team_id: string;
  season_id: number;
  arc_type: CareerArcType;
  stage: CareerArcStage;
  started_at: string;
  resolved_at: string | null;
  headline: string;
  summary: string;
  consequences_json: string;
};

type LedgerRow = {
  id: number;
  team_id: string;
  season_id: number;
  ledger_type: TeamHistoryLedgerType;
  subject_id: string | null;
  subject_name: string;
  opponent_team_id: string | null;
  stat_value: number;
  secondary_value: number;
  note: string | null;
  extra_json: string;
  updated_at: string;
};

type OffseasonPhase = 'transfer_window' | 'roster_lock' | 'preseason';

let activeDbName = 'slot_1.db';
let offseasonNextId = 1;
let offseasonActiveState: {
  id: number;
  save_id: number;
  phase: OffseasonPhase;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_active: number;
} | null = null;

const careerArcRows: CareerArcRow[] = [
  {
    id: 1,
    save_id: 1,
    team_id: 'team_a',
    season_id: 101,
    arc_type: 'rebuild',
    stage: 'emerging',
    started_at: '2026-03-01',
    resolved_at: null,
    headline: 'Rebuild begins',
    summary: 'A young core is taking shape.',
    consequences_json: JSON.stringify(['young core rising']),
  },
  {
    id: 2,
    save_id: 1,
    team_id: 'team_a',
    season_id: 102,
    arc_type: 'dynasty',
    stage: 'active',
    started_at: '2027-09-20',
    resolved_at: null,
    headline: 'Dynasty pressure',
    summary: 'The club is defending a title standard.',
    consequences_json: JSON.stringify(['legacy pressure rising']),
  },
];

const ledgerRows: LedgerRow[] = [
  {
    id: 10,
    team_id: 'team_a',
    season_id: 101,
    ledger_type: 'franchise_icon',
    subject_id: 'p1',
    subject_name: 'Veteran Mid',
    opponent_team_id: null,
    stat_value: 0,
    secondary_value: 0,
    note: 'Current franchise face.',
    extra_json: JSON.stringify(['mid']),
    updated_at: '2026-11-01',
  },
  {
    id: 11,
    team_id: 'team_a',
    season_id: 102,
    ledger_type: 'rivalry_record',
    subject_id: null,
    subject_name: 'Gen.G',
    opponent_team_id: 'team_b',
    stat_value: 5,
    secondary_value: 3,
    note: 'Regional rivalry series updated.',
    extra_json: JSON.stringify(['rivalry']),
    updated_at: '2027-09-21',
  },
];

const setActiveGameDatabaseMock = vi.fn(async (fileName: string) => {
  activeDbName = fileName;
});

const getSaveByIdMock = vi.fn(async () => ({
  id: 1,
  metadataId: 1,
  mode: 'manager',
  userTeamId: 'team_a',
  currentSeasonId: 102,
  dbFilename: 'slot_1.db',
  createdAt: '2026-01-01',
  updatedAt: '2027-09-21',
  slotNumber: 1,
  saveName: 'Long Save Workflow',
  playTimeMinutes: 420,
}));

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const y = next.getUTCFullYear();
  const m = `${next.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${next.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const selectMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes('FROM teams WHERE id =')) return [{ id: 'team_a' }];
  if (sql.includes('FROM seasons WHERE id =')) {
    const seasonId = params[0] as number;
    return seasonId === 102 ? [{ id: 102 }] : [];
  }
  if (sql.includes('FROM players WHERE id =')) return [];
  if (sql.includes('COUNT(*) as cnt FROM players WHERE team_id =')) return [{ cnt: 5 }];
  if (sql.includes('SELECT 1 FROM player_chemistry')) return [{ 1: 1 }];
  if (sql.includes('SELECT 1 FROM player_satisfaction')) return [{ 1: 1 }];
  if (sql.includes('SELECT 1 FROM player_solo_rank')) return [{ 1: 1 }];

  if (sql.includes('FROM career_arc_events')) {
    const saveId = params[0] as number;
    const teamId = params[1] as string | null;
    const limit = params[2] as number;
    return [...careerArcRows]
      .filter((row) => row.save_id === saveId && (teamId == null || row.team_id === teamId))
      .sort((left, right) => right.started_at.localeCompare(left.started_at))
      .slice(0, limit);
  }

  if (sql.includes('FROM team_history_ledger')) {
    const teamId = params[0] as string;
    const seasonId = params[1] as number | null;
    const limit = params[2] as number;
    return [...ledgerRows]
      .filter((row) => row.team_id === teamId && (seasonId == null || row.season_id === seasonId))
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
      .slice(0, limit);
  }

  if (sql.includes('FROM offseason_state WHERE save_id =')) {
    return offseasonActiveState && offseasonActiveState.is_active === 1 ? [offseasonActiveState] : [];
  }

  return [];
});

const executeMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.startsWith('UPDATE offseason_state SET is_active = 0 WHERE save_id')) {
    if (offseasonActiveState && offseasonActiveState.save_id === params[0]) {
      offseasonActiveState.is_active = 0;
    }
    return { rowsAffected: 1 };
  }

  if (sql.startsWith('INSERT INTO offseason_state')) {
    offseasonActiveState = {
      id: offseasonNextId++,
      save_id: params[0] as number,
      phase: params[1] as OffseasonPhase,
      start_date: params[2] as string,
      end_date: params[3] as string,
      days_remaining: params[4] as number,
      is_active: 1,
    };
    return { lastInsertId: offseasonActiveState.id };
  }

  if (sql.startsWith('UPDATE offseason_state SET is_active = 0, days_remaining = 0')) {
    if (offseasonActiveState && offseasonActiveState.id === params[0]) {
      offseasonActiveState.is_active = 0;
      offseasonActiveState.days_remaining = 0;
    }
    return { rowsAffected: 1 };
  }

  if (sql.startsWith('UPDATE offseason_state SET days_remaining =')) {
    if (offseasonActiveState && offseasonActiveState.id === params[1]) {
      offseasonActiveState.days_remaining = params[0] as number;
    }
    return { rowsAffected: 1 };
  }

  return { rowsAffected: 0 };
});

vi.mock('../../db/database', () => ({
  AUTOSAVE_DATABASE_FILE: 'autosave.db',
  checkpointActiveGameDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  copyGameDatabase: vi.fn(),
  deleteGameDatabase: vi.fn(),
  gameDatabaseExists: vi.fn(async () => true),
  getActiveGameDatabaseName: vi.fn(() => activeDbName),
  getDatabase: vi.fn(async () => ({
    select: selectMock,
    execute: executeMock,
  })),
  getGameDatabaseFileName: vi.fn((slot: number) => `slot_${slot}.db`),
  setActiveGameDatabase: setActiveGameDatabaseMock,
}));

vi.mock('../../db/queries', () => ({
  createManualSave: vi.fn(),
  getAllSaves: vi.fn(),
  getAutoSave: vi.fn(),
  getSaveById: getSaveByIdMock,
  deleteSave: vi.fn(),
  updatePlayTime: vi.fn(),
  updateSaveMeta: vi.fn(),
  getPlayerRelations: vi.fn(async () => []),
  getPlayersByTeamId: vi.fn(async () => []),
}));

vi.mock('../../stores/gameStore', () => ({
  useGameStore: {
    getState: vi.fn(() => ({
      save: null,
      season: null,
      teams: [],
      setSave: vi.fn(),
    })),
  },
}));

vi.mock('../../utils/random', () => ({
  getBaseSeed: vi.fn(() => 'long-save-seed'),
}));

vi.mock('../board/boardEngine', () => ({
  getBoardExpectations: vi.fn(async () => null),
}));

vi.mock('../manager/managerCareerEngine', () => ({
  getManagerCareer: vi.fn(async () => []),
  getCareerSummary: vi.fn(async () => null),
}));

vi.mock('../staff/staffEngine', () => ({
  getStaffFitSummary: vi.fn(async () => []),
}));

vi.mock('../manager/systemDepthEngine', () => ({
  createOngoingConsequence: vi.fn(async () => undefined),
}));

vi.mock('../season/calendar', () => ({
  addDays,
}));

describe('long save workflow release gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeDbName = 'slot_1.db';
    offseasonNextId = 1;
    offseasonActiveState = null;
  });

  it('loads a progressed save, preserves prior narrative history, and completes offseason transitions', async () => {
    const { loadSave } = await import('./saveEngine');
    const { getCareerArcEvents, getTeamHistoryLedger } = await import('../manager/releaseDepthEngine');
    const { startOffseason, advanceOffseasonDay, getCurrentOffseasonState } = await import('../season/offseasonEngine');

    const save = await loadSave(1);
    expect(save.currentSeasonId).toBe(102);
    expect(setActiveGameDatabaseMock).toHaveBeenCalledWith('slot_1.db');

    const careerArcs = await getCareerArcEvents(save.id, save.userTeamId, 8);
    const ledger = await getTeamHistoryLedger(save.userTeamId, undefined, 24);

    expect(careerArcs).toHaveLength(2);
    expect(careerArcs.some((event) => event.seasonId === 101)).toBe(true);
    expect(careerArcs.some((event) => event.seasonId === 102)).toBe(true);
    expect(ledger).toHaveLength(2);
    expect(ledger.some((entry) => entry.seasonId === 101 && entry.ledgerType === 'franchise_icon')).toBe(true);
    expect(ledger.some((entry) => entry.seasonId === 102 && entry.ledgerType === 'rivalry_record')).toBe(true);

    const started = await startOffseason(save.id, '2027-09-21');
    expect(started.phase).toBe('transfer_window');

    let state = started;
    for (let day = 0; day < 14; day += 1) {
      state = (await advanceOffseasonDay(save.id, addDays('2027-09-21', day))) ?? state;
    }
    expect((await getCurrentOffseasonState(save.id))?.phase).toBe('roster_lock');

    for (let day = 0; day < 7; day += 1) {
      state = (await advanceOffseasonDay(save.id, addDays('2027-10-05', day))) ?? state;
    }
    expect((await getCurrentOffseasonState(save.id))?.phase).toBe('preseason');

    let finalState = await getCurrentOffseasonState(save.id);
    for (let day = 0; day < 7; day += 1) {
      finalState = await advanceOffseasonDay(save.id, addDays('2027-10-12', day));
    }
    expect(finalState).toBeNull();
  });
});
