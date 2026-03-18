/**
 * 부상 시스템 엔진
 * - 훈련/경기 시 부상 확률 체크
 * - 매일 회복 처리
 * - 부상 선수 조회
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import type { InjuryType, PlayerInjury } from '../../types/injury';
import { INJURY_TYPE_LABELS } from '../../types/injury';
import type { DayType } from '../season/calendar';
import { addDays } from '../season/calendar';

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

interface InjuryRow {
  id: number;
  player_id: string;
  team_id: string;
  injury_type: string;
  severity: number;
  days_remaining: number;
  occurred_date: string;
  expected_return: string;
  is_recovered: number;
}

function mapRowToInjury(row: InjuryRow): PlayerInjury {
  return {
    id: row.id,
    playerId: row.player_id,
    teamId: row.team_id,
    injuryType: row.injury_type as InjuryType,
    severity: row.severity,
    daysRemaining: row.days_remaining,
    occurredDate: row.occurred_date,
    expectedReturn: row.expected_return,
    isRecovered: row.is_recovered === 1,
  };
}

// ─────────────────────────────────────────
// 부상 확률 & 랜덤
// ─────────────────────────────────────────

/** dayType별 기본 부상 확률 */
const INJURY_CHANCE_BY_DAY: Record<string, number> = {
  match_day: 0.015,
  scrim: 0.008,
  training: 0.005,
  rest: 0.001,
};

/** 부상 유형 가중치 (누적 확률용) */
const INJURY_TYPE_WEIGHTS: { type: InjuryType; weight: number }[] = [
  { type: 'wrist', weight: 0.40 },
  { type: 'back', weight: 0.20 },
  { type: 'eye', weight: 0.15 },
  { type: 'mental_burnout', weight: 0.15 },
  { type: 'minor', weight: 0.10 },
];

/** severity 가중치 */
const SEVERITY_WEIGHTS = [
  { severity: 1, weight: 0.60 },
  { severity: 2, weight: 0.30 },
  { severity: 3, weight: 0.10 },
];

/** severity별 결장 일수 범위 */
const DAYS_BY_SEVERITY: Record<number, [number, number]> = {
  1: [3, 7],
  2: [7, 21],
  3: [21, 42],
};

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────
// 핵심 함수
// ─────────────────────────────────────────

/**
 * 훈련/경기 시 부상 확률 체크
 * @returns 새로 발생한 부상 목록
 */
export async function checkForInjuries(
  teamId: string,
  date: string,
  dayType: DayType,
): Promise<PlayerInjury[]> {
  const baseChance = INJURY_CHANCE_BY_DAY[dayType] ?? 0.005;
  const players = await getPlayersByTeamId(teamId);
  const db = await getDatabase();

  // 이미 부상 중인 선수 제외
  const injuredIds = await getInjuredPlayerIds(teamId);
  const healthyPlayers = players.filter(p => !injuredIds.has(p.id) && p.division === 'main');

  const newInjuries: PlayerInjury[] = [];

  for (const player of healthyPlayers) {
    let chance = baseChance;

    // stamina 30 이하: 확률 1.5배
    if (player.mental.stamina <= 30) {
      chance *= 1.5;
    }

    if (Math.random() >= chance) continue;

    // 부상 발생
    const injuryType = pickWeighted(INJURY_TYPE_WEIGHTS).type;
    const severity = pickWeighted(SEVERITY_WEIGHTS).severity;
    const [minDays, maxDays] = DAYS_BY_SEVERITY[severity];
    const daysRemaining = randomInt(minDays, maxDays);
    const expectedReturn = addDays(date, daysRemaining);

    await db.execute(
      `INSERT INTO player_injuries (player_id, team_id, injury_type, severity, days_remaining, occurred_date, expected_return)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [player.id, teamId, injuryType, severity, daysRemaining, date, expectedReturn],
    );

    // 삽입된 ID 조회
    const rows = await db.select<{ id: number }[]>(
      'SELECT last_insert_rowid() as id',
    );
    const injuryId = rows[0]?.id ?? 0;

    const injury: PlayerInjury = {
      id: injuryId,
      playerId: player.id,
      teamId,
      injuryType,
      severity,
      daysRemaining,
      occurredDate: date,
      expectedReturn,
      isRecovered: false,
    };

    newInjuries.push(injury);
  }

  return newInjuries;
}

/**
 * 매일 호출: daysRemaining -1, 0이면 회복 처리
 */
export async function advanceInjuryDay(teamId: string, date: string): Promise<string[]> {
  const db = await getDatabase();
  const recoveredNames: string[] = [];

  // daysRemaining 감소
  await db.execute(
    `UPDATE player_injuries
     SET days_remaining = days_remaining - 1
     WHERE team_id = $1 AND is_recovered = 0`,
    [teamId],
  );

  // 회복된 선수 조회
  const recoveredRows = await db.select<{ id: number; player_id: string }[]>(
    `SELECT pi.id, pi.player_id
     FROM player_injuries pi
     WHERE pi.team_id = $1 AND pi.is_recovered = 0 AND pi.days_remaining <= 0`,
    [teamId],
  );

  if (recoveredRows.length > 0) {
    // 회복 처리
    await db.execute(
      `UPDATE player_injuries
       SET is_recovered = 1
       WHERE team_id = $1 AND is_recovered = 0 AND days_remaining <= 0`,
      [teamId],
    );

    // 선수 이름 조회
    for (const row of recoveredRows) {
      const nameRows = await db.select<{ name: string }[]>(
        'SELECT name FROM players WHERE id = $1',
        [row.player_id],
      );
      if (nameRows[0]) {
        recoveredNames.push(nameRows[0].name);
      }
    }
  }

  return recoveredNames;
}

/**
 * 현재 부상 선수 목록
 */
export async function getActiveInjuries(teamId: string): Promise<PlayerInjury[]> {
  const db = await getDatabase();
  const rows = await db.select<InjuryRow[]>(
    `SELECT * FROM player_injuries
     WHERE team_id = $1 AND is_recovered = 0
     ORDER BY days_remaining ASC`,
    [teamId],
  );
  return rows.map(mapRowToInjury);
}

/**
 * 특정 선수 부상 여부
 */
export async function isPlayerInjured(playerId: string): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM player_injuries
     WHERE player_id = $1 AND is_recovered = 0`,
    [playerId],
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

/**
 * 팀의 부상 중인 선수 ID Set
 */
export async function getInjuredPlayerIds(teamId: string): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.select<{ player_id: string }[]>(
    `SELECT player_id FROM player_injuries
     WHERE team_id = $1 AND is_recovered = 0`,
    [teamId],
  );
  return new Set(rows.map(r => r.player_id));
}

/**
 * 부상 이력 (회복 포함 전체)
 */
export async function getInjuryHistory(teamId: string): Promise<PlayerInjury[]> {
  const db = await getDatabase();
  const rows = await db.select<InjuryRow[]>(
    `SELECT * FROM player_injuries
     WHERE team_id = $1
     ORDER BY occurred_date DESC`,
    [teamId],
  );
  return rows.map(mapRowToInjury);
}

/**
 * 부상 발생 이벤트 텍스트 생성
 */
export function formatInjuryEvent(playerName: string, injury: PlayerInjury): string {
  const typeLabel = INJURY_TYPE_LABELS[injury.injuryType];
  return `${playerName} — ${typeLabel} (${injury.daysRemaining}일 결장)`;
}
