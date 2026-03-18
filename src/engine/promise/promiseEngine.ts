/**
 * 선수 약속 엔진
 * - 약속 생성/이행/불이행 관리
 * - 주간 이행 여부 체크
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
    id: result.lastInsertId,
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

    // 이행 조건 체크 (간단 버전)
    let isMet = false;
    if (row.promise_type === 'starter_guarantee' || row.promise_type === 'playtime') {
      // 선수가 현재 1군인지 확인
      const divRows = await db.select<{ division: string }[]>(
        'SELECT division FROM players WHERE id = $1',
        [row.player_id],
      );
      isMet = divRows[0]?.division === '1군';
    }

    if (isMet) {
      await fulfillPromise(row.id);
      fulfilled++;
    }
  }

  return { fulfilled, broken };
}

export async function fulfillPromise(promiseId: number): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<PromiseRow[]>('SELECT * FROM manager_promises WHERE id = $1', [promiseId]);
  if (rows.length === 0) return;

  await db.execute('UPDATE manager_promises SET is_fulfilled = 1 WHERE id = $1', [promiseId]);
  await db.execute('UPDATE players SET morale = MIN(100, morale + 5) WHERE id = $1', [rows[0].player_id]);
}

export async function breakPromise(promiseId: number): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<PromiseRow[]>('SELECT * FROM manager_promises WHERE id = $1', [promiseId]);
  if (rows.length === 0) return;

  await db.execute('UPDATE manager_promises SET is_broken = 1, trust_penalty = 15 WHERE id = $1', [promiseId]);
  await db.execute('UPDATE players SET morale = MAX(0, morale - 15) WHERE id = $1', [rows[0].player_id]);
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
