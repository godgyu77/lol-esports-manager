/**
 * 멘토링 시스템
 * - 시니어 선수(25+)가 주니어 선수(22-)를 멘토링
 * - 같은 포지션 조건
 * - 멘티: 보너스 스탯 +0.05/일, 멘토: teamwork +0.02/일
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import type { Player } from '../../types/player';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface MentoringPair {
  id: number;
  mentorId: string;
  menteeId: string;
  teamId: string;
  startDate: string;
  bonusStat: string | null;
  dailyGrowthBonus: number;
  isActive: boolean;
}

interface MentoringRow {
  id: number;
  mentor_id: string;
  mentee_id: string;
  team_id: string;
  start_date: string;
  bonus_stat: string | null;
  daily_growth_bonus: number;
  is_active: number;
}

function mapRow(row: MentoringRow): MentoringPair {
  return {
    id: row.id,
    mentorId: row.mentor_id,
    menteeId: row.mentee_id,
    teamId: row.team_id,
    startDate: row.start_date,
    bonusStat: row.bonus_stat,
    dailyGrowthBonus: row.daily_growth_bonus,
    isActive: Boolean(row.is_active),
  };
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** 선수의 가장 높은 스탯 이름 반환 */
function getHighestStat(player: Player): string {
  const stats = player.stats;
  const entries: [string, number][] = [
    ['mechanical', stats.mechanical],
    ['gameSense', stats.gameSense],
    ['teamwork', stats.teamwork],
    ['consistency', stats.consistency],
    ['laning', stats.laning],
    ['aggression', stats.aggression],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** snake_case → camelCase 스탯 매핑 (DB 컬럼명) */
const STAT_TO_COLUMN: Record<string, string> = {
  mechanical: 'mechanical',
  gameSense: 'game_sense',
  teamwork: 'teamwork',
  consistency: 'consistency',
  laning: 'laning',
  aggression: 'aggression',
};

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 멘토 배정
 * 조건: 멘토 나이 >= 25, 멘티 나이 <= 22, 같은 포지션
 */
export async function assignMentor(
  mentorId: string,
  menteeId: string,
  teamId: string,
  startDate: string,
): Promise<{ success: boolean; message: string }> {
  const players = await getPlayersByTeamId(teamId);
  const mentor = players.find(p => p.id === mentorId);
  const mentee = players.find(p => p.id === menteeId);

  if (!mentor || !mentee) {
    return { success: false, message: '선수를 찾을 수 없습니다.' };
  }

  if (mentor.age < 25) {
    return { success: false, message: '멘토는 25세 이상이어야 합니다.' };
  }

  if (mentee.age > 22) {
    return { success: false, message: '멘티는 22세 이하여야 합니다.' };
  }

  if (mentor.position !== mentee.position) {
    return { success: false, message: '멘토와 멘티는 같은 포지션이어야 합니다.' };
  }

  const bonusStat = getHighestStat(mentor);

  const db = await getDatabase();

  // 기존 멘토링 비활성화
  await db.execute(
    'UPDATE player_mentoring SET is_active = 0 WHERE mentee_id = $1',
    [menteeId],
  );

  await db.execute(
    `INSERT INTO player_mentoring (mentor_id, mentee_id, team_id, start_date, bonus_stat, daily_growth_bonus, is_active)
     VALUES ($1, $2, $3, $4, $5, 0.05, 1)`,
    [mentorId, menteeId, teamId, startDate, bonusStat],
  );

  return { success: true, message: `${mentor.name}이(가) ${mentee.name}의 멘토로 배정되었습니다. (보너스: ${bonusStat})` };
}

/**
 * 멘토 해제
 */
export async function removeMentor(menteeId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE player_mentoring SET is_active = 0 WHERE mentee_id = $1',
    [menteeId],
  );
}

/**
 * 일간 멘토링 효과 처리
 * - 멘티: 보너스 스탯 +0.05/일
 * - 멘토: teamwork +0.02/일
 */
export async function processMentoringDay(teamId: string): Promise<void> {
  const db = await getDatabase();
  const pairs = await getMentoringPairs(teamId);

  for (const pair of pairs) {
    if (!pair.bonusStat) continue;

    const column = STAT_TO_COLUMN[pair.bonusStat];
    if (!column) continue;

    // 멘티 보너스 스탯 증가
    await db.execute(
      `UPDATE players SET ${column} = MIN(${column} + $1, 100) WHERE id = $2`,
      [pair.dailyGrowthBonus, pair.menteeId],
    );

    // 멘토 teamwork 증가
    await db.execute(
      'UPDATE players SET teamwork = MIN(teamwork + $1, 100) WHERE id = $2',
      [0.02, pair.mentorId],
    );
  }
}

/**
 * 현재 멘토링 쌍 조회
 */
export async function getMentoringPairs(teamId: string): Promise<MentoringPair[]> {
  const db = await getDatabase();
  const rows = await db.select<MentoringRow[]>(
    'SELECT * FROM player_mentoring WHERE team_id = $1 AND is_active = 1',
    [teamId],
  );
  return rows.map(mapRow);
}

/**
 * 멘토 자격 선수 목록 (25세 이상)
 */
export async function getEligibleMentors(teamId: string): Promise<Player[]> {
  const players = await getPlayersByTeamId(teamId);
  return players.filter(p => p.age >= 25);
}

/**
 * 멘티 자격 선수 목록 (22세 이하, 현재 멘토링 받고 있지 않은)
 */
export async function getEligibleMentees(teamId: string): Promise<Player[]> {
  const players = await getPlayersByTeamId(teamId);
  const activePairs = await getMentoringPairs(teamId);
  const menteeIds = new Set(activePairs.map(p => p.menteeId));
  return players.filter(p => p.age <= 22 && !menteeIds.has(p.id));
}
