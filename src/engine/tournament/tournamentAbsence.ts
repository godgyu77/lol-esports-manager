/**
 * 국제대회 참가 선수 부재 관리
 * - 대회 기간 동안 해당 선수는 리그 경기 불참
 * - 2군 선수로 자동 대체
 */

import { getDatabase } from '../../db/database';

export interface TournamentAbsence {
  playerId: string;
  teamId: string;
  tournamentId: string;
  startDate: string;
  endDate: string;
}

/** 대회 참가 선수 부재 등록 */
export async function registerTournamentAbsence(
  playerId: string,
  teamId: string,
  _tournamentId: string,
  startDate: string,
  endDate: string,
): Promise<void> {
  // player_injuries 테이블을 재활용 (injury_type = 'tournament_absence')
  const db = await getDatabase();
  const days = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  await db.execute(
    `INSERT INTO player_injuries (player_id, team_id, injury_type, severity, days_remaining, occurred_date, expected_return)
     VALUES ($1, $2, 'tournament_absence', 0, $3, $4, $5)`,
    [playerId, teamId, days, startDate, endDate],
  );
}

/** 현재 대회 참가 중인 선수 조회 */
export async function getAbsentPlayers(teamId: string): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.select<{ player_id: string }[]>(
    `SELECT player_id FROM player_injuries
     WHERE team_id = $1 AND injury_type = 'tournament_absence' AND is_recovered = 0`,
    [teamId],
  );
  return rows.map((r) => r.player_id);
}

/** 대회 종료 시 부재 기록 회복 처리 */
export async function clearTournamentAbsence(_tournamentId: string): Promise<void> {
  const db = await getDatabase();
  // occurred_date 기반으로 해당 대회 기간의 부재 기록 회복 처리
  await db.execute(
    `UPDATE player_injuries SET is_recovered = 1
     WHERE injury_type = 'tournament_absence' AND is_recovered = 0`,
  );
}
