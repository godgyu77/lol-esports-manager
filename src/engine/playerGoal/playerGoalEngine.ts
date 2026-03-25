/**
 * 선수 개인 목표 엔진
 * - 시즌 시작 시 각 선수에게 목표 자동 배정
 * - 시즌 종료 시 달성 확인 + 사기 보정
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import type { Player, PlayerStats } from '../../types/player';
import type { PlayerGoal, PlayerGoalType } from '../../types/playerGoal';
import { nextRandom } from '../../utils/random';

// ─────────────────────────────────────────
// DB 매핑
// ─────────────────────────────────────────

interface PlayerGoalRow {
  id: number;
  player_id: string;
  season_id: number;
  goal_type: string;
  target_value: string | null;
  is_achieved: number;
  reward_morale: number;
  created_at: string;
}

function mapRowToGoal(row: PlayerGoalRow): PlayerGoal {
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    goalType: row.goal_type as PlayerGoalType,
    targetValue: row.target_value,
    isAchieved: row.is_achieved === 1,
    rewardMorale: row.reward_morale,
  };
}

// ─────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────

/** 선수 OVR 계산 */
function calculateOVR(stats: PlayerStats): number {
  const { mechanical, gameSense, teamwork, consistency, laning, aggression } = stats;
  return Math.round((mechanical + gameSense + teamwork + consistency + laning + aggression) / 6);
}

/** 가장 낮은 스탯 이름과 값 */
function getLowestStat(stats: PlayerStats): { stat: string; value: number } {
  const entries: [string, number][] = [
    ['mechanical', stats.mechanical],
    ['gameSense', stats.gameSense],
    ['teamwork', stats.teamwork],
    ['consistency', stats.consistency],
    ['laning', stats.laning],
    ['aggression', stats.aggression],
  ];
  entries.sort((a, b) => a[1] - b[1]);
  return { stat: entries[0][0], value: entries[0][1] };
}

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

/**
 * 시즌 시작 시 팀 소속 선수에게 목표 자동 배정
 */
export async function generatePlayerGoals(
  teamId: string,
  seasonId: number,
  teamReputation?: number,
): Promise<PlayerGoal[]> {
  const db = await getDatabase();
  const players = await getPlayersByTeamId(teamId);
  const goals: PlayerGoal[] = [];

  for (const player of players) {
    const ovr = calculateOVR(player.stats);
    let goalType: PlayerGoalType;
    let targetValue: string | null = null;
    let rewardMorale = 10;

    if (ovr >= 80) {
      // 고능력 선수: MVP 후보 or All-Pro
      goalType = nextRandom() < 0.5 ? 'mvp_candidate' : 'all_pro';
      rewardMorale = 15;
    } else if (player.age <= 20) {
      // 젊은 선수: 스탯 향상 (가장 낮은 스탯 +10)
      const lowest = getLowestStat(player.stats);
      goalType = 'improve_stat';
      targetValue = `${lowest.stat}:${lowest.value + 10}`;
      rewardMorale = 12;
    } else if ((player as Player & { division?: string }).teamId === null ||
               ((player as unknown as { division: string }).division === 'academy')) {
      // 2군(아카데미) 선수: 주전 확보
      goalType = 'starter';
      rewardMorale = 10;
    } else if ((teamReputation ?? 0) >= 70) {
      // 팀 명성 70+: 국제대회 진출
      goalType = 'international';
      rewardMorale = 12;
    } else {
      // 기본: 스탯 향상
      const lowest = getLowestStat(player.stats);
      goalType = 'improve_stat';
      targetValue = `${lowest.stat}:${lowest.value + 10}`;
      rewardMorale = 10;
    }

    const result = await db.execute(
      `INSERT INTO player_goals (player_id, season_id, goal_type, target_value, is_achieved, reward_morale)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [player.id, seasonId, goalType, targetValue, rewardMorale],
    );

    goals.push({
      id: result.lastInsertId as number,
      playerId: player.id,
      seasonId,
      goalType,
      targetValue,
      isAchieved: false,
      rewardMorale,
    });
  }

  return goals;
}

/**
 * 시즌 종료 시 목표 달성 확인 + 사기 보정
 * - 달성 시: morale +10~15
 * - 미달성 시: morale -5
 */
export async function checkGoalAchievement(
  playerId: string,
  seasonId: number,
): Promise<{ achieved: boolean; moraleChange: number } | null> {
  const db = await getDatabase();

  const goalRows = await db.select<PlayerGoalRow[]>(
    'SELECT * FROM player_goals WHERE player_id = $1 AND season_id = $2',
    [playerId, seasonId],
  );
  if (goalRows.length === 0) return null;

  const goal = mapRowToGoal(goalRows[0]);

  // 현재 선수 데이터로 달성 여부 판정
  const playerRows = await db.select<{ mechanical: number; game_sense: number; teamwork: number; consistency: number; laning: number; aggression: number; division: string }[]>(
    'SELECT mechanical, game_sense, teamwork, consistency, laning, aggression, division FROM players WHERE id = $1',
    [playerId],
  );
  if (playerRows.length === 0) return null;

  const row = playerRows[0];
  const stats: PlayerStats = {
    mechanical: row.mechanical,
    gameSense: row.game_sense,
    teamwork: row.teamwork,
    consistency: row.consistency,
    laning: row.laning,
    aggression: row.aggression,
  };

  let achieved = false;

  switch (goal.goalType) {
    case 'mvp_candidate':
    case 'all_pro': {
      // OVR 85 이상이면 달성으로 간주
      const ovr = calculateOVR(stats);
      achieved = ovr >= 85;
      break;
    }
    case 'international': {
      // 팀이 국제대회에 참가했으면 달성 (대회 매치 존재 여부)
      const tournamentMatches = await db.select<{ cnt: number }[]>(
        `SELECT COUNT(*) as cnt FROM matches
         WHERE (team_home_id IN (SELECT team_id FROM players WHERE id = $1)
            OR team_away_id IN (SELECT team_id FROM players WHERE id = $1))
           AND season_id = $2
           AND (id LIKE 'msi_%' OR id LIKE 'worlds_%' OR id LIKE 'ewc_%')`,
        [playerId, seasonId],
      );
      achieved = (tournamentMatches[0]?.cnt ?? 0) > 0;
      break;
    }
    case 'starter': {
      // 1군(main)이면 달성
      achieved = row.division !== 'academy';
      break;
    }
    case 'improve_stat': {
      // target_value 파싱하여 해당 스탯이 목표치 이상인지 확인
      if (goal.targetValue) {
        const [statName, targetStr] = goal.targetValue.split(':');
        const target = parseInt(targetStr, 10);
        const statMap: Record<string, number> = {
          mechanical: stats.mechanical,
          gameSense: stats.gameSense,
          teamwork: stats.teamwork,
          consistency: stats.consistency,
          laning: stats.laning,
          aggression: stats.aggression,
        };
        achieved = (statMap[statName] ?? 0) >= target;
      }
      break;
    }
  }

  // DB 업데이트
  await db.execute(
    'UPDATE player_goals SET is_achieved = $1 WHERE id = $2',
    [achieved ? 1 : 0, goal.id],
  );

  // 사기 보정
  const moraleChange = achieved ? goal.rewardMorale : -5;
  await db.execute(
    'UPDATE players SET morale = MIN(100, MAX(0, morale + $1)) WHERE id = $2',
    [moraleChange, playerId],
  );

  return { achieved, moraleChange };
}

/**
 * 특정 선수의 시즌 목표 조회
 */
export async function getPlayerGoals(
  playerId: string,
  seasonId: number,
): Promise<PlayerGoal[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerGoalRow[]>(
    'SELECT * FROM player_goals WHERE player_id = $1 AND season_id = $2',
    [playerId, seasonId],
  );
  return rows.map(mapRowToGoal);
}

/**
 * 팀 전체 선수의 시즌 목표 조회
 */
export async function getTeamGoals(
  teamId: string,
  seasonId: number,
): Promise<PlayerGoal[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerGoalRow[]>(
    `SELECT pg.* FROM player_goals pg
     JOIN players p ON pg.player_id = p.id
     WHERE p.team_id = $1 AND pg.season_id = $2`,
    [teamId, seasonId],
  );
  return rows.map(mapRowToGoal);
}
