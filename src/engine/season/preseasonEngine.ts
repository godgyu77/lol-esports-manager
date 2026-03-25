/**
 * 프리시즌/부트캠프 엔진
 * 오프시즌 Phase 3에서 실행되는 부트캠프 시스템.
 * - 팀워크 전체 +0.3/일
 * - 랜덤 2명 친밀도 +3/일
 * - 스태미나 전원 회복 +5/일
 * - 모든 선수 폼 리셋 (50 기준)
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId, batchUpsertPlayerConditions } from '../../db/queries';
import { shuffleArray } from '../../utils/random';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface BootcampProgress {
  currentDay: number;  // 1~7
  totalDays: number;   // 7
  effects: string[];   // 적용된 효과 설명
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

const BOOTCAMP_TOTAL_DAYS = 7;
const TEAMWORK_DAILY_GAIN = 0.3;
const AFFINITY_DAILY_GAIN = 3;
const STAMINA_DAILY_RECOVERY = 5;
const FORM_RESET_TARGET = 50;

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

/**
 * 부트캠프 일간 효과 처리
 */
export async function processBootcampDay(
  teamId: string,
  date: string,
): Promise<string[]> {
  const db = await getDatabase();
  const players = await getPlayersByTeamId(teamId);
  const effects: string[] = [];

  if (players.length === 0) return effects;

  // 1. 팀워크 전체 +0.3/일
  for (const player of players) {
    const newTeamwork = Math.min(100, player.stats.teamwork + TEAMWORK_DAILY_GAIN);
    await db.execute(
      'UPDATE players SET teamwork = $1 WHERE id = $2',
      [newTeamwork, player.id],
    );
  }
  effects.push(`팀워크 전체 +${TEAMWORK_DAILY_GAIN}`);

  // 2. 랜덤 2명 친밀도 +3/일 (player_relations 테이블)
  if (players.length >= 2) {
    const shuffled = shuffleArray(players);
    const pair = [shuffled[0], shuffled[1]];

    // 친밀도 업데이트 (양방향)
    await db.execute(
      `INSERT INTO player_relations (player_a_id, player_b_id, affinity, trust, created_at)
       VALUES ($1, $2, $3, 0, CURRENT_TIMESTAMP)
       ON CONFLICT(player_a_id, player_b_id) DO UPDATE SET affinity = MIN(100, affinity + $3)`,
      [pair[0].id, pair[1].id, AFFINITY_DAILY_GAIN],
    );
    effects.push(`${pair[0].name}과 ${pair[1].name}의 친밀도 +${AFFINITY_DAILY_GAIN}`);
  }

  // 3. 스태미나 전원 회복 +5/일 & 4. 폼 리셋 (50 기준)
  const conditionRecords = players.map(player => ({
    playerId: player.id,
    gameDate: date,
    stamina: Math.min(100, player.mental.stamina + STAMINA_DAILY_RECOVERY),
    morale: player.mental.morale,
    form: FORM_RESET_TARGET,
  }));

  await batchUpsertPlayerConditions(conditionRecords);
  effects.push(`스태미나 전원 +${STAMINA_DAILY_RECOVERY}`);
  effects.push('폼 전원 리셋 (50)');

  return effects;
}

/**
 * 부트캠프 진행 상황 조회 (7일 중 N일째)
 * daysRemaining 기반으로 계산
 */
export function getBootcampProgress(daysRemaining: number): BootcampProgress {
  const currentDay = BOOTCAMP_TOTAL_DAYS - daysRemaining + 1;
  return {
    currentDay: Math.min(currentDay, BOOTCAMP_TOTAL_DAYS),
    totalDays: BOOTCAMP_TOTAL_DAYS,
    effects: [],
  };
}
