/**
 * 상대팀 분석 리포트 엔진
 * - 분석관 능력 기반 리포트 생성
 * - 상대 강점/약점/추천 밴
 * - 상대팀 패턴 추적 (최근 10경기)
 * - 약점 분석 (포지션별 KDA, 갱킹 취약도, 초반/후반 패배 경향)
 */

import { getDatabase } from '../../db/database';
import type {
  MatchAnalysisReport,
  OpponentPatterns,
  OpponentWeaknesses,
  PositionChampionPicks,
} from '../../types/analysis';
import { calculateStaffBonuses } from '../staff/staffEngine';

// ─────────────────────────────────────────
// 상대팀 패턴 추적
// ─────────────────────────────────────────

/**
 * 상대팀의 최근 10경기 패턴을 분석
 * - 포지션별 최다 픽 챔피언
 * - 전략 유형별 승률 (초반 어그로 vs 후반 스케일)
 * - 평균 경기 시간
 * - 퍼스트 블러드 획득률
 */
export async function trackOpponentPatterns(opponentTeamId: string): Promise<OpponentPatterns> {
  const db = await getDatabase();

  // 최근 10경기의 게임 데이터
  const gameRows = await db.select<{
    game_id: string;
    match_id: string;
    winner_team_id: string | null;
    duration_seconds: number | null;
    gold_diff_at_15: number | null;
    team_home_id: string;
  }[]>(
    `SELECT g.id AS game_id, g.match_id, g.winner_team_id, g.duration_seconds, g.gold_diff_at_15,
            m.team_home_id
     FROM games g
     JOIN matches m ON m.id = g.match_id
     WHERE (m.team_home_id = $1 OR m.team_away_id = $1) AND m.is_played = 1
     ORDER BY m.played_at DESC
     LIMIT 10`,
    [opponentTeamId],
  );

  // 평균 경기 시간 (분)
  const durations = gameRows
    .map(g => g.duration_seconds)
    .filter((d): d is number => d != null && d > 0);
  const averageGameDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
    : 30;

  // 전략별 승률 분석 (15분 골드 차이 기반: 양수 = 홈팀 유리)
  let earlyAggroWins = 0;
  let earlyAggroTotal = 0;
  let lateScaleWins = 0;
  let lateScaleTotal = 0;

  for (const g of gameRows) {
    if (g.duration_seconds == null || g.gold_diff_at_15 == null) continue;
    const isHome = g.team_home_id === opponentTeamId;
    const won = g.winner_team_id === opponentTeamId;
    const goldAdvantageAt15 = isHome ? g.gold_diff_at_15 : -g.gold_diff_at_15;

    // 15분 골드 리드 1000 이상 = 초반 어그로 성향 경기
    if (goldAdvantageAt15 > 1000) {
      earlyAggroTotal++;
      if (won) earlyAggroWins++;
    }
    // 경기 시간 30분 이상 = 후반 스케일 성향 경기
    if (g.duration_seconds >= 1800) {
      lateScaleTotal++;
      if (won) lateScaleWins++;
    }
  }

  const strategyWinRates = {
    earlyAggro: {
      wins: earlyAggroWins,
      total: earlyAggroTotal,
      rate: earlyAggroTotal > 0 ? earlyAggroWins / earlyAggroTotal : 0,
    },
    lateScale: {
      wins: lateScaleWins,
      total: lateScaleTotal,
      rate: lateScaleTotal > 0 ? lateScaleWins / lateScaleTotal : 0,
    },
  };

  // 퍼스트 블러드 획득률 (골드 차이 15분에 유리한 쪽 = 퍼스트 블러드 근사치)
  const gamesWithGold = gameRows.filter(g => g.gold_diff_at_15 != null);
  let firstBloodCount = 0;
  for (const g of gamesWithGold) {
    const isHome = g.team_home_id === opponentTeamId;
    const goldAdv = isHome ? (g.gold_diff_at_15 ?? 0) : -(g.gold_diff_at_15 ?? 0);
    if (goldAdv > 0) firstBloodCount++;
  }
  const firstBloodRate = gamesWithGold.length > 0 ? firstBloodCount / gamesWithGold.length : 0.5;

  // 포지션별 최다 픽 챔피언
  const gameIds = gameRows.map(g => g.game_id);
  const mostPickedByPosition: PositionChampionPicks[] = [];

  if (gameIds.length > 0) {
    const placeholders = gameIds.map((_, i) => `$${i + 2}`).join(', ');
    const pickRows = await db.select<{ position: string; champion_id: string; pick_count: number }[]>(
      `SELECT pgs.position, cp.champion_id, COUNT(*) AS pick_count
       FROM player_game_stats pgs
       JOIN champion_proficiency cp ON cp.player_id = pgs.player_id
       WHERE pgs.team_id = $1 AND pgs.game_id IN (${placeholders})
       GROUP BY pgs.position, cp.champion_id
       ORDER BY pgs.position, pick_count DESC`,
      [opponentTeamId, ...gameIds],
    );

    // 포지션별 그룹핑
    const byPosition = new Map<string, { championId: string; pickCount: number }[]>();
    for (const row of pickRows) {
      const list = byPosition.get(row.position) ?? [];
      list.push({ championId: row.champion_id, pickCount: row.pick_count });
      byPosition.set(row.position, list);
    }

    for (const [position, champions] of byPosition) {
      mostPickedByPosition.push({
        position,
        champions: champions.slice(0, 3), // 상위 3개
      });
    }
  }

  return {
    mostPickedByPosition,
    strategyWinRates,
    averageGameDuration,
    firstBloodRate,
  };
}

// ─────────────────────────────────────────
// 상대팀 약점 분석
// ─────────────────────────────────────────

/**
 * 상대팀의 약점을 식별
 * - KDA가 가장 낮은 포지션
 * - 사망이 가장 많은 포지션 (갱킹 취약)
 * - 초반/후반 중 더 많이 지는 시점
 */
export async function getOpponentWeaknesses(opponentTeamId: string): Promise<OpponentWeaknesses> {
  const db = await getDatabase();

  // 포지션별 평균 KDA (최근 10경기)
  const kdaRows = await db.select<{
    position: string;
    avg_kills: number;
    avg_deaths: number;
    avg_assists: number;
  }[]>(
    `SELECT pgs.position,
            AVG(pgs.kills) AS avg_kills,
            AVG(pgs.deaths) AS avg_deaths,
            AVG(pgs.assists) AS avg_assists
     FROM player_game_stats pgs
     JOIN matches m ON m.id = pgs.match_id
     WHERE pgs.team_id = $1 AND m.is_played = 1
     GROUP BY pgs.position
     ORDER BY pgs.position`,
    [opponentTeamId],
  );

  const positionKda: { position: string; kda: number }[] = [];
  let worstKdaPosition: string | null = null;
  let worstKda = Infinity;
  let mostDeathsPosition: string | null = null;
  let maxDeaths = 0;

  for (const row of kdaRows) {
    const deaths = Math.max(row.avg_deaths, 1);
    const kda = (row.avg_kills + row.avg_assists) / deaths;
    positionKda.push({ position: row.position, kda: Math.round(kda * 100) / 100 });

    if (kda < worstKda) {
      worstKda = kda;
      worstKdaPosition = row.position;
    }
    if (row.avg_deaths > maxDeaths) {
      maxDeaths = row.avg_deaths;
      mostDeathsPosition = row.position;
    }
  }

  // 초반/후반 패배 경향 분석 (15분 골드 차이 vs 경기 결과)
  const phaseRows = await db.select<{
    winner_team_id: string | null;
    gold_diff_at_15: number | null;
    duration_seconds: number | null;
    team_home_id: string;
  }[]>(
    `SELECT g.winner_team_id, g.gold_diff_at_15, g.duration_seconds, m.team_home_id
     FROM games g
     JOIN matches m ON m.id = g.match_id
     WHERE (m.team_home_id = $1 OR m.team_away_id = $1) AND m.is_played = 1
     ORDER BY m.played_at DESC LIMIT 10`,
    [opponentTeamId],
  );

  let earlyLosses = 0; // 15분 골드 뒤처진 상태에서 패배
  let lateLosses = 0;  // 15분 골드 유리했지만 패배 (후반 패배)
  let totalLosses = 0;

  for (const row of phaseRows) {
    const lost = row.winner_team_id !== opponentTeamId && row.winner_team_id != null;
    if (!lost) continue;
    totalLosses++;

    const isHome = row.team_home_id === opponentTeamId;
    const goldAdv = isHome ? (row.gold_diff_at_15 ?? 0) : -(row.gold_diff_at_15 ?? 0);

    if (goldAdv < -500) {
      earlyLosses++; // 초반에 이미 뒤처져서 패배
    } else if (goldAdv > 500) {
      lateLosses++; // 초반 유리했지만 후반에 패배
    }
  }

  let weakPhase: 'early' | 'late' | 'balanced' = 'balanced';
  if (totalLosses > 0) {
    const earlyRatio = earlyLosses / totalLosses;
    const lateRatio = lateLosses / totalLosses;
    if (earlyRatio > 0.5) weakPhase = 'early';
    else if (lateRatio > 0.5) weakPhase = 'late';
  }

  return {
    worstKdaPosition,
    mostGankedPosition: mostDeathsPosition,
    weakPhase,
    positionKda,
  };
}

// ─────────────────────────────────────────
// 리포트 생성
// ─────────────────────────────────────────

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

  // 상대팀 패턴 분석 (정확도 65+ 시)
  let opponentPatterns: OpponentPatterns | null = null;
  if (accuracy >= 65) {
    try {
      opponentPatterns = await trackOpponentPatterns(opponentTeamId);
    } catch { /* 데이터 부족 시 null */ }
  }

  // 상대팀 약점 분석 (정확도 75+ 시)
  let opponentWeaknesses: OpponentWeaknesses | null = null;
  if (accuracy >= 75) {
    try {
      opponentWeaknesses = await getOpponentWeaknesses(opponentTeamId);
    } catch { /* 데이터 부족 시 null */ }
  }

  // DB 저장
  const result = await db.execute(
    `INSERT INTO match_analysis_reports (team_id, opponent_team_id, accuracy, recent_wins, recent_losses, play_style, key_player_id, weak_position, recommended_bans, generated_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [userTeamId, opponentTeamId, accuracy, wins, losses, playStyle, keyPlayerId, weakPosition, JSON.stringify(recommendedBans), currentDate],
  );

  return {
    id: result.lastInsertId ?? 0,
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
    opponentPatterns,
    opponentWeaknesses,
  };
}
