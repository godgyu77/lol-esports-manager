/**
 * 상대팀 분석 리포트 엔진
 * - 분석관 능력 기반 리포트 생성
 * - 상대 강점/약점/추천 밴
 */

import { getDatabase } from '../../db/database';
import type { MatchAnalysisReport } from '../../types/analysis';
import { calculateStaffBonuses } from '../staff/staffEngine';

export async function generateOpponentReport(
  userTeamId: string,
  opponentTeamId: string,
  currentDate: string,
): Promise<MatchAnalysisReport> {
  const db = await getDatabase();

  // 분석관 능력 기반 정확도
  let accuracy = 50;
  try {
    const bonuses = await calculateStaffBonuses(userTeamId);
    accuracy = Math.min(95, 50 + bonuses.draftAccuracy);
  } catch { /* 기본값 */ }

  // 상대팀 최근 전적
  const recentRows = await db.select<{ score_home: number; score_away: number; team_home_id: string }[]>(
    `SELECT score_home, score_away, team_home_id FROM matches
     WHERE (team_home_id = $1 OR team_away_id = $1) AND is_played = 1
     ORDER BY played_at DESC LIMIT 5`,
    [opponentTeamId],
  );

  let wins = 0;
  let losses = 0;
  for (const r of recentRows) {
    const isHome = r.team_home_id === opponentTeamId;
    const won = isHome ? r.score_home > r.score_away : r.score_away > r.score_home;
    if (won) wins++;
    else losses++;
  }

  // 상대 팀 플레이스타일
  const styleRows = await db.select<{ play_style: string }[]>(
    'SELECT play_style FROM teams WHERE id = $1',
    [opponentTeamId],
  );
  const playStyle = styleRows[0]?.play_style ?? null;

  // 상대 팀 약한 포지션 (가장 낮은 OVR)
  let weakPosition: string | null = null;
  let keyPlayerId: string | null = null;

  if (accuracy >= 60) {
    const playerRows = await db.select<{ id: string; position: string; mechanical: number; game_sense: number; teamwork: number; consistency: number; laning: number; aggression: number }[]>(
      `SELECT id, position, mechanical, game_sense, teamwork, consistency, laning, aggression
       FROM players WHERE team_id = $1 AND division = '1군'`,
      [opponentTeamId],
    );

    if (playerRows.length > 0) {
      let minOvr = 999;
      let maxOvr = 0;
      for (const p of playerRows) {
        const ovr = (p.mechanical + p.game_sense + p.teamwork + p.consistency + p.laning + p.aggression) / 6;
        if (ovr < minOvr) { minOvr = ovr; weakPosition = p.position; }
        if (ovr > maxOvr) { maxOvr = ovr; keyPlayerId = p.id; }
      }
    }
  }

  // 추천 밴 (정확도 70+ 에서만)
  const recommendedBans: string[] = [];
  if (accuracy >= 70) {
    const champRows = await db.select<{ champion_id: string; proficiency: number }[]>(
      `SELECT cp.champion_id, cp.proficiency FROM champion_proficiency cp
       JOIN players p ON p.id = cp.player_id
       WHERE p.team_id = $1 AND p.division = '1군'
       ORDER BY cp.proficiency DESC LIMIT 3`,
      [opponentTeamId],
    );
    for (const c of champRows) {
      recommendedBans.push(c.champion_id);
    }
  }

  // DB 저장
  const result = await db.execute(
    `INSERT INTO match_analysis_reports (team_id, opponent_team_id, accuracy, recent_wins, recent_losses, play_style, key_player_id, weak_position, recommended_bans, generated_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [userTeamId, opponentTeamId, accuracy, wins, losses, playStyle, keyPlayerId, weakPosition, JSON.stringify(recommendedBans), currentDate],
  );

  return {
    id: result.lastInsertId,
    teamId: userTeamId,
    opponentTeamId,
    accuracy,
    recentWins: wins,
    recentLosses: losses,
    playStyle,
    keyPlayerId,
    weakPosition,
    recommendedBans,
    generatedDate: currentDate,
  };
}
