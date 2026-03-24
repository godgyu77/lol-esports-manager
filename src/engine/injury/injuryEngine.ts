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
  staffInjuryPreventionBonus = 0,
): Promise<PlayerInjury[]> {
  // 영양사/물리치료사가 있으면 부상 확률 감소 (injuryPreventionBonus는 음수값)
  const baseChance = Math.max(0.001, (INJURY_CHANCE_BY_DAY[dayType] ?? 0.005) * (1 + staffInjuryPreventionBonus));
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

    const result = await db.execute(
      `INSERT INTO player_injuries (player_id, team_id, injury_type, severity, days_remaining, occurred_date, expected_return)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [player.id, teamId, injuryType, severity, daysRemaining, date, expectedReturn],
    );

    const injuryId = result.lastInsertId ?? 0;

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
 * gym 레벨 3+ 시 회복 10% 가속 (추가 감소)
 * 물리치료사(injuryRecoveryBonus) 있으면 추가 회복 가속
 */
export async function advanceInjuryDay(teamId: string, _date: string, gymLevel?: number, staffInjuryRecoveryBonus = 0): Promise<string[]> {
  const db = await getDatabase();
  const recoveredNames: string[] = [];

  // daysRemaining 감소 (gym 레벨 3+ → 10% 확률로 추가 1일 감소)
  const gymExtra = (gymLevel ?? 0) >= 3 && Math.random() < 0.1 ? 1 : 0;
  // 물리치료사 보너스: injuryRecoveryBonus는 음수(-0.05~-0.2), 확률적으로 추가 1일 감소
  const staffExtra = staffInjuryRecoveryBonus < 0 && Math.random() < Math.abs(staffInjuryRecoveryBonus) ? 1 : 0;
  const extraRecovery = gymExtra + staffExtra;
  await db.execute(
    `UPDATE player_injuries
     SET days_remaining = days_remaining - $1
     WHERE team_id = $2 AND is_recovered = 0`,
    [1 + extraRecovery, teamId],
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

/**
 * 부상 회복 진행률 계산 (0~100%)
 */
export function calculateRecoveryProgress(injury: PlayerInjury): number {
  const severityDays = DAYS_BY_SEVERITY[injury.severity];
  if (!severityDays) return 0;
  const totalDays = severityDays[1]; // 최대 기간 기준
  const elapsed = totalDays - injury.daysRemaining;
  return Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
}

// ─────────────────────────────────────────
// 과훈련 → 부상 연동
// ─────────────────────────────────────────

/**
 * 과훈련으로 인한 부상 체크
 * 스태미나가 낮고 강도가 높을수록 부상 확률 증가
 */
export async function checkOvertrainingInjury(
  playerId: string,
  teamId: string,
  stamina: number,
  trainingIntensity: 'light' | 'normal' | 'intense',
  date: string,
): Promise<PlayerInjury | null> {
  let chance = 0;
  if (stamina < 20 && trainingIntensity === 'intense') chance = 0.25;
  else if (stamina < 20 && trainingIntensity === 'normal') chance = 0.10;
  else if (stamina < 30 && trainingIntensity === 'intense') chance = 0.10;
  else return null;

  if (Math.random() >= chance) return null;

  // 과훈련 부상은 주로 손목/번아웃
  const overtrainingTypes: InjuryType[] = ['wrist', 'mental_burnout', 'back'];
  const injuryType = overtrainingTypes[Math.floor(Math.random() * overtrainingTypes.length)];
  const severity = Math.random() < 0.7 ? 1 : 2; // 주로 경미~보통
  const [minDays, maxDays] = DAYS_BY_SEVERITY[severity];
  const daysRemaining = randomInt(minDays, maxDays);
  const expectedReturn = addDays(date, daysRemaining);

  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO player_injuries (player_id, team_id, injury_type, severity, days_remaining, occurred_date, expected_return)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [playerId, teamId, injuryType, severity, daysRemaining, date, expectedReturn],
  );

  return {
    id: result.lastInsertId ?? 0,
    playerId, teamId, injuryType, severity, daysRemaining,
    occurredDate: date, expectedReturn, isRecovered: false,
  };
}

// ─────────────────────────────────────────
// 부상 심각도별 디버프
// ─────────────────────────────────────────

export interface InjuryDebuff {
  statPenalty: number;    // 전체 스탯 페널티
  reinjuryRisk: number;  // 재부상 일일 확률
  daysRemaining: number; // 디버프 남은 일수
}

/**
 * 부상 복귀 후 디버프 계산
 * severity 2: -2 스탯, 7일간
 * severity 3: -5 스탯, 14일간 + 재부상 5%
 */
export async function getInjuryDebuff(playerId: string, currentDate: string): Promise<InjuryDebuff | null> {
  const db = await getDatabase();
  // 최근 회복된 부상 조회 (14일 이내)
  const rows = await db.select<InjuryRow[]>(
    `SELECT * FROM player_injuries
     WHERE player_id = $1 AND is_recovered = 1
     AND expected_return >= date($2, '-14 days')
     ORDER BY expected_return DESC LIMIT 1`,
    [playerId, currentDate],
  );

  if (rows.length === 0) return null;

  const injury = rows[0];
  if (injury.severity < 2) return null;

  // 복귀일로부터 경과 일수 계산
  const returnDate = new Date(injury.expected_return);
  const current = new Date(currentDate);
  const daysSinceReturn = Math.floor((current.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));

  if (injury.severity === 2) {
    const debuffDays = 7;
    if (daysSinceReturn >= debuffDays) return null;
    return { statPenalty: -2, reinjuryRisk: 0, daysRemaining: debuffDays - daysSinceReturn };
  }

  if (injury.severity === 3) {
    const debuffDays = 14;
    if (daysSinceReturn >= debuffDays) return null;
    return { statPenalty: -5, reinjuryRisk: daysSinceReturn < 7 ? 0.05 : 0, daysRemaining: debuffDays - daysSinceReturn };
  }

  return null;
}
