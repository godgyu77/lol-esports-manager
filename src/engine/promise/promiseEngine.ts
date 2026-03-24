/**
 * 선수 약속 엔진
 * - 약속 생성/이행/불이행 관리
 * - 주간 이행 여부 체크
 * - 약속 유형별 조건 검증
 * - 불이행 시 만족도/사기 페널티
 */

import { getDatabase } from '../../db/database';
import type { ManagerPromise, PromiseType } from '../../types/promise';

interface PromiseRow {
  id: number;
  player_id: string;
  team_id: string;
  promise_type: string;
  promise_date: string;
  deadline_date: string;
  is_fulfilled: number;
  is_broken: number;
  trust_penalty: number;
}

function mapRow(r: PromiseRow): ManagerPromise {
  return {
    id: r.id,
    playerId: r.player_id,
    teamId: r.team_id,
    promiseType: r.promise_type as PromiseType,
    promiseDate: r.promise_date,
    deadlineDate: r.deadline_date,
    isFulfilled: r.is_fulfilled === 1,
    isBroken: r.is_broken === 1,
    trustPenalty: r.trust_penalty,
  };
}

/** 약속 유형별 불이행 페널티 */
export const PROMISE_PENALTIES: Record<PromiseType, { morale: number; trust: number }> = {
  starter_guarantee: { morale: -15, trust: 20 },
  no_transfer: { morale: -10, trust: 15 },
  salary_raise: { morale: -12, trust: 18 },
  playtime: { morale: -15, trust: 20 },
  new_signing: { morale: -8, trust: 10 },
  championship_goal: { morale: -5, trust: 8 },
  playoff_goal: { morale: -5, trust: 8 },
  transfer_allow: { morale: -20, trust: 25 },
};

/** 약속 유형별 이행 보상 */
export const PROMISE_REWARDS: Record<PromiseType, { morale: number }> = {
  starter_guarantee: { morale: 5 },
  no_transfer: { morale: 3 },
  salary_raise: { morale: 8 },
  playtime: { morale: 5 },
  new_signing: { morale: 4 },
  championship_goal: { morale: 15 },
  playoff_goal: { morale: 10 },
  transfer_allow: { morale: 8 },
};

export async function makePromise(
  playerId: string,
  teamId: string,
  type: PromiseType,
  promiseDate: string,
  deadlineDays = 30,
): Promise<ManagerPromise> {
  const db = await getDatabase();
  const d = new Date(promiseDate);
  d.setDate(d.getDate() + deadlineDays);
  const deadlineDate = d.toISOString().slice(0, 10);

  const result = await db.execute(
    `INSERT INTO manager_promises (player_id, team_id, promise_type, promise_date, deadline_date)
     VALUES ($1, $2, $3, $4, $5)`,
    [playerId, teamId, type, promiseDate, deadlineDate],
  );

  // 약속으로 즉시 사기 +3
  await db.execute('UPDATE players SET morale = MIN(100, morale + 3) WHERE id = $1', [playerId]);

  return {
    id: result.lastInsertId ?? 0,
    playerId, teamId, promiseType: type,
    promiseDate, deadlineDate,
    isFulfilled: false, isBroken: false, trustPenalty: 0,
  };
}

export async function checkPromises(teamId: string, currentDate: string): Promise<{ fulfilled: number; broken: number }> {
  const db = await getDatabase();
  let fulfilled = 0;
  let broken = 0;

  const rows = await db.select<PromiseRow[]>(
    `SELECT * FROM manager_promises WHERE team_id = $1 AND is_fulfilled = 0 AND is_broken = 0`,
    [teamId],
  );

  for (const row of rows) {
    // 마감일 지났으면 불이행
    if (currentDate > row.deadline_date) {
      await breakPromise(row.id);
      broken++;
      continue;
    }

    // 이행 조건 체크
    const isMet = await checkPromiseCondition(db, row);

    if (isMet) {
      await fulfillPromise(row.id);
      fulfilled++;
    }
  }

  return { fulfilled, broken };
}

/**
 * 약속 유형별 이행 조건 검증
 */
async function checkPromiseCondition(
  db: Awaited<ReturnType<typeof getDatabase>>,
  row: PromiseRow,
): Promise<boolean> {
  const type = row.promise_type as PromiseType;

  switch (type) {
    case 'starter_guarantee':
    case 'playtime': {
      // 선수가 현재 주전(main)인지 확인
      const divRows = await db.select<{ division: string }[]>(
        'SELECT division FROM players WHERE id = $1',
        [row.player_id],
      );
      return divRows[0]?.division === 'main';
    }

    case 'no_transfer': {
      // 선수가 아직 같은 팀에 있는지 확인
      const teamRows = await db.select<{ team_id: string | null }[]>(
        'SELECT team_id FROM players WHERE id = $1',
        [row.player_id],
      );
      return teamRows[0]?.team_id === row.team_id;
    }

    case 'salary_raise': {
      // 약속 이후 연봉이 올랐는지 확인 (약속 시점 대비)
      // 연봉 인상은 계약 갱신 시 처리되므로, 계약 갱신이 약속 이후인지 확인
      // 간단 판정: 갱신 시 외부에서 fulfillPromise 호출하는 방식으로 처리
      // 실제로는 갱신 시점에 fulfillPromise를 호출하는 것이 더 정확
      return false; // 갱신 시 외부에서 fulfillPromise 호출
    }

    case 'new_signing': {
      // 해당 선수 포지션에 새 영입이 있었는지 확인
      const playerRows = await db.select<{ position: string }[]>(
        'SELECT position FROM players WHERE id = $1',
        [row.player_id],
      );
      if (playerRows.length === 0) return false;
      const position = playerRows[0].position;

      // 약속 이후 해당 포지션 영입 확인
      const newPlayers = await db.select<{ id: string }[]>(
        `SELECT id FROM players
         WHERE team_id = $1 AND position = $2 AND id != $3`,
        [row.team_id, position, row.player_id],
      );
      return newPlayers.length >= 2; // 자신 포함 2명 이상이면 보강됨
    }

    case 'championship_goal': {
      // 우승 여부 확인 (시즌 결과에서)
      const trophyRows = await db.select<{ id: number }[]>(
        `SELECT id FROM awards WHERE team_id = $1 AND award_type = 'champion'
         AND award_date >= $2`,
        [row.team_id, row.promise_date],
      );
      return trophyRows.length > 0;
    }

    case 'playoff_goal': {
      // 플레이오프 진출 확인 (순위 6위 이내)
      const standingRows = await db.select<{ standing: number }[]>(
        `SELECT standing FROM standings
         WHERE team_id = $1 ORDER BY season_id DESC LIMIT 1`,
        [row.team_id],
      );
      return (standingRows[0]?.standing ?? 99) <= 6;
    }

    case 'transfer_allow': {
      // 선수가 팀을 떠났는지 확인 (이적 허용 약속)
      const teamRows = await db.select<{ team_id: string | null }[]>(
        'SELECT team_id FROM players WHERE id = $1',
        [row.player_id],
      );
      return teamRows[0]?.team_id !== row.team_id;
    }

    default:
      return false;
  }
}

export async function fulfillPromise(promiseId: number): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<PromiseRow[]>('SELECT * FROM manager_promises WHERE id = $1', [promiseId]);
  if (rows.length === 0) return;

  const row = rows[0];
  const type = row.promise_type as PromiseType;
  const reward = PROMISE_REWARDS[type] ?? { morale: 5 };

  await db.execute('UPDATE manager_promises SET is_fulfilled = 1 WHERE id = $1', [promiseId]);
  await db.execute(
    'UPDATE players SET morale = MIN(100, morale + $1) WHERE id = $2',
    [reward.morale, row.player_id],
  );

  // 만족도 보너스: 약속 이행 시 만족도 +5
  try {
    await db.execute(
      `UPDATE player_satisfaction SET overall_satisfaction = MIN(100, overall_satisfaction + 5)
       WHERE player_id = $1`,
      [row.player_id],
    );
  } catch { /* 테이블 미존재 시 무시 */ }
}

export async function breakPromise(promiseId: number): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<PromiseRow[]>('SELECT * FROM manager_promises WHERE id = $1', [promiseId]);
  if (rows.length === 0) return;

  const row = rows[0];
  const type = row.promise_type as PromiseType;
  const penalty = PROMISE_PENALTIES[type] ?? { morale: -15, trust: 15 };

  await db.execute(
    'UPDATE manager_promises SET is_broken = 1, trust_penalty = $1 WHERE id = $2',
    [penalty.trust, promiseId],
  );
  await db.execute(
    'UPDATE players SET morale = MAX(0, morale + $1) WHERE id = $2',
    [penalty.morale, row.player_id],
  );

  // 만족도 페널티: 약속 불이행 시 만족도 -10
  try {
    await db.execute(
      `UPDATE player_satisfaction SET overall_satisfaction = MAX(0, overall_satisfaction - 10)
       WHERE player_id = $1`,
      [row.player_id],
    );
  } catch { /* 테이블 미존재 시 무시 */ }
}

export async function getActivePromises(teamId: string): Promise<ManagerPromise[]> {
  const db = await getDatabase();
  const rows = await db.select<PromiseRow[]>(
    'SELECT * FROM manager_promises WHERE team_id = $1 AND is_fulfilled = 0 AND is_broken = 0 ORDER BY deadline_date',
    [teamId],
  );
  return rows.map(mapRow);
}

export async function getAllPromises(teamId: string): Promise<ManagerPromise[]> {
  const db = await getDatabase();
  const rows = await db.select<PromiseRow[]>(
    'SELECT * FROM manager_promises WHERE team_id = $1 ORDER BY promise_date DESC',
    [teamId],
  );
  return rows.map(mapRow);
}

/**
 * 약속 이행률 통계 조회
 */
export async function getPromiseStats(teamId: string): Promise<{
  total: number;
  fulfilled: number;
  broken: number;
  active: number;
  fulfillmentRate: number;
}> {
  const db = await getDatabase();
  const rows = await db.select<{ total: number; fulfilled: number; broken: number }[]>(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN is_fulfilled = 1 THEN 1 ELSE 0 END) as fulfilled,
       SUM(CASE WHEN is_broken = 1 THEN 1 ELSE 0 END) as broken
     FROM manager_promises WHERE team_id = $1`,
    [teamId],
  );

  const { total, fulfilled, broken } = rows[0] ?? { total: 0, fulfilled: 0, broken: 0 };
  const active = total - fulfilled - broken;
  const completed = fulfilled + broken;
  const fulfillmentRate = completed > 0 ? Math.round((fulfilled / completed) * 100) : 100;

  return { total, fulfilled, broken, active, fulfillmentRate };
}
