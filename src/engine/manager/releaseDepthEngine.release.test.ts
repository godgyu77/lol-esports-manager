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

let nextCareerArcId = 1;
let careerArcRows: CareerArcRow[] = [];
let ledgerRows: LedgerRow[] = [];

const executeMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes('INSERT INTO career_arc_events')) {
    const row: CareerArcRow = {
      id: nextCareerArcId++,
      save_id: params[0] as number,
      team_id: params[1] as string,
      season_id: params[2] as number,
      arc_type: params[3] as CareerArcType,
      stage: params[4] as CareerArcStage,
      started_at: params[5] as string,
      resolved_at: (params[6] as string | null) ?? null,
      headline: params[7] as string,
      summary: params[8] as string,
      consequences_json: params[9] as string,
    };
    careerArcRows.push(row);
    return { lastInsertId: row.id };
  }

  return { rowsAffected: 1 };
});

const selectMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes('FROM career_arc_events') && sql.includes('LIMIT 1') && sql.includes('stage =')) {
    return careerArcRows.filter((row) =>
      row.save_id === params[0] &&
      row.team_id === params[1] &&
      row.season_id === params[2] &&
      row.arc_type === params[3] &&
      row.stage === params[4],
    ).slice(0, 1);
  }

  if (sql.includes('SELECT * FROM career_arc_events WHERE id = $1')) {
    return careerArcRows.filter((row) => row.id === params[0]);
  }

  if (sql.includes('FROM career_arc_events')) {
    const saveId = params[0] as number;
    const teamId = params[1] as string | null;
    const limit = params[2] as number;
    return [...careerArcRows]
      .filter((row) => row.save_id === saveId && (teamId == null || row.team_id === teamId))
      .sort((left, right) => {
        if (left.started_at === right.started_at) return right.id - left.id;
        return right.started_at.localeCompare(left.started_at);
      })
      .slice(0, limit);
  }

  if (sql.includes('FROM team_history_ledger')) {
    const teamId = params[0] as string;
    const seasonId = params[1] as number | null;
    const limit = params[2] as number;
    return [...ledgerRows]
      .filter((row) => row.team_id === teamId && (seasonId == null || row.season_id === seasonId))
      .sort((left, right) => {
        if (left.updated_at === right.updated_at) return right.id - left.id;
        return right.updated_at.localeCompare(left.updated_at);
      })
      .slice(0, limit);
  }

  return [];
});

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn(async () => ({
    execute: executeMock,
    select: selectMock,
  })),
}));

vi.mock('../../db/queries', () => ({
  getPlayerRelations: vi.fn(async () => []),
  getPlayersByTeamId: vi.fn(async () => []),
}));

vi.mock('../board/boardEngine', () => ({
  getBoardExpectations: vi.fn(async () => null),
}));

vi.mock('./managerCareerEngine', () => ({
  getManagerCareer: vi.fn(async () => []),
  getCareerSummary: vi.fn(async () => ({
    totalSeasons: 3,
    totalWins: 40,
    totalLosses: 20,
    winRate: 66.7,
    totalTrophies: 2,
    trophyList: ['LCK Spring', 'LCK Summer'],
    teamsManaged: ['T1'],
    bestStanding: 1,
    worstStanding: 3,
    longestTenure: { teamName: 'T1', seasons: 3 },
    firingCount: 0,
    playoffAppearances: 3,
    reputationScore: 85,
    winRateTrend: [],
    standingTrend: [],
  })),
}));

vi.mock('../staff/staffEngine', () => ({
  getStaffFitSummary: vi.fn(async () => []),
}));

vi.mock('./systemDepthEngine', () => ({
  createOngoingConsequence: vi.fn(async () => undefined),
}));

describe('releaseDepthEngine release persistence gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextCareerArcId = 1;
    careerArcRows = [
      {
        id: 1,
        save_id: 7,
        team_id: 'team_a',
        season_id: 1,
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
        save_id: 7,
        team_id: 'team_a',
        season_id: 2,
        arc_type: 'dynasty',
        stage: 'active',
        started_at: '2027-09-20',
        resolved_at: null,
        headline: 'Dynasty pressure',
        summary: 'The club is now defending a title standard.',
        consequences_json: JSON.stringify(['legacy pressure rising']),
      },
    ];

    ledgerRows = [
      {
        id: 10,
        team_id: 'team_a',
        season_id: 1,
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
        season_id: 2,
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
  });

  it('keeps career arc history readable across multiple seasons in the same save', async () => {
    const { getCareerArcEvents } = await import('./releaseDepthEngine');

    const events = await getCareerArcEvents(7, 'team_a', 8);

    expect(events).toHaveLength(2);
    expect(events[0].seasonId).toBe(2);
    expect(events[0].headline).toBe('Dynasty pressure');
    expect(events[1].seasonId).toBe(1);
  });

  it('keeps team history ledger readable across seasons when no season filter is applied', async () => {
    const { getTeamHistoryLedger } = await import('./releaseDepthEngine');

    const ledger = await getTeamHistoryLedger('team_a', undefined, 24);

    expect(ledger).toHaveLength(2);
    expect(ledger[0].seasonId).toBe(2);
    expect(ledger[0].ledgerType).toBe('rivalry_record');
    expect(ledger[1].seasonId).toBe(1);
    expect(ledger[1].ledgerType).toBe('franchise_icon');
  });

  it('prevents duplicate arc creation when the same season/stage was already recorded', async () => {
    const { recordCareerArcEvent, getCareerArcEvents } = await import('./releaseDepthEngine');

    const duplicate = await recordCareerArcEvent({
      saveId: 7,
      teamId: 'team_a',
      seasonId: 2,
      arcType: 'dynasty',
      stage: 'active',
      startedAt: '2027-09-21',
      headline: 'Should not duplicate',
      summary: 'Duplicate event should be blocked.',
      consequences: ['legacy pressure rising'],
    });

    expect(duplicate).toBeNull();

    const events = await getCareerArcEvents(7, 'team_a', 8);
    expect(events.filter((event) => event.arcType === 'dynasty' && event.stage === 'active')).toHaveLength(1);
  });
});
