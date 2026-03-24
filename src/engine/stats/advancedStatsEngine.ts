/**
 * 고급 통계 엔진
 * - 선수별 경기 데이터 기반 상세 통계 산출
 * - KDA, 분당 지표, 팀 내 비중 등 파생 메트릭
 * - 최근 폼 추세 및 리그 리더보드
 */

import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface AdvancedPlayerStats {
  playerId: string;
  // 경기당 평균
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgCS: number;
  avgGold: number;
  avgDamage: number;
  // 파생 메트릭
  kda: number;                // (K+A)/D
  csPerMin: number;
  goldPerMin: number;
  damagePerMin: number;
  killParticipation: number;  // (K+A)/teamKills
  deathShare: number;         // D/teamDeaths
  goldShare: number;          // gold/teamGold
  damageShare: number;        // damage/teamDamage
  // 추세
  formTrend: 'rising' | 'stable' | 'declining';
  recentKDA: number;          // 최근 5경기 KDA
  totalGames: number;
}

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface PlayerAggRow {
  player_id: string;
  games: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_cs: number;
  total_gold: number;
  total_damage: number;
}

interface TeamTotalsRow {
  team_id: string;
  team_kills: number;
  team_deaths: number;
  team_gold: number;
  team_damage: number;
}

interface GameDurationRow {
  match_id: string;
  avg_duration: number;
}

interface RecentGameRow {
  kills: number;
  deaths: number;
  assists: number;
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 기본 경기 시간 (분) — duration 정보 없을 경우 */
const DEFAULT_GAME_DURATION_MIN = 30;

/** 최근 폼 판단용 경기 수 */
const RECENT_GAMES_COUNT = 5;

/** 폼 추세 판단 임계값 */
const TREND_THRESHOLD = 0.5;

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function safeDiv(numerator: number, denominator: number, fallback = 0): number {
  return denominator > 0 ? numerator / denominator : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateKDA(kills: number, deaths: number, assists: number): number {
  return deaths === 0 ? kills + assists : round2((kills + assists) / deaths);
}

// ─────────────────────────────────────────
// 핵심 함수
// ─────────────────────────────────────────

/**
 * 특정 선수의 고급 통계 산출
 * @param playerId 선수 ID
 * @param seasonId 시즌 ID (미지정 시 전체 시즌)
 */
export async function calculateAdvancedStats(
  playerId: string,
  seasonId?: number,
): Promise<AdvancedPlayerStats> {
  const db = await getDatabase();

  // 1. 선수 총계 집계
  const seasonFilter = seasonId != null
    ? 'AND m.season_id = $2'
    : '';
  const params: unknown[] = seasonId != null ? [playerId, seasonId] : [playerId];

  const aggRows = await db.select<PlayerAggRow[]>(
    `SELECT
      pgs.player_id,
      COUNT(*) as games,
      SUM(pgs.kills) as total_kills,
      SUM(pgs.deaths) as total_deaths,
      SUM(pgs.assists) as total_assists,
      SUM(pgs.cs) as total_cs,
      SUM(pgs.gold_earned) as total_gold,
      SUM(pgs.damage_dealt) as total_damage
    FROM player_game_stats pgs
    JOIN matches m ON m.id = pgs.match_id
    WHERE pgs.player_id = $1 ${seasonFilter}
    GROUP BY pgs.player_id`,
    params,
  );

  if (aggRows.length === 0) {
    return createEmptyStats(playerId);
  }

  const agg = aggRows[0];

  // 2. 해당 선수가 속한 팀의 총계 (팀 내 비중 계산용)
  const teamTotalsRows = await db.select<TeamTotalsRow[]>(
    `SELECT
      pgs2.team_id,
      SUM(pgs2.kills) as team_kills,
      SUM(pgs2.deaths) as team_deaths,
      SUM(pgs2.gold_earned) as team_gold,
      SUM(pgs2.damage_dealt) as team_damage
    FROM player_game_stats pgs2
    WHERE pgs2.team_id = (SELECT team_id FROM players WHERE id = $1)
      AND pgs2.match_id IN (
        SELECT DISTINCT pgs3.match_id FROM player_game_stats pgs3
        JOIN matches m2 ON m2.id = pgs3.match_id
        WHERE pgs3.player_id = $1 ${seasonFilter}
      )
    GROUP BY pgs2.team_id`,
    params,
  );

  const teamTotals = teamTotalsRows.length > 0
    ? teamTotalsRows[0]
    : { team_kills: 0, team_deaths: 0, team_gold: 0, team_damage: 0, team_id: '' };

  // 3. 평균 경기 시간 (games 테이블)
  const durationRows = await db.select<GameDurationRow[]>(
    `SELECT
      g.match_id,
      AVG(g.duration_seconds) as avg_duration
    FROM games g
    WHERE g.match_id IN (
      SELECT DISTINCT pgs4.match_id FROM player_game_stats pgs4
      JOIN matches m3 ON m3.id = pgs4.match_id
      WHERE pgs4.player_id = $1 ${seasonFilter}
    )
    GROUP BY g.match_id`,
    params,
  );

  const avgDurationMin = durationRows.length > 0
    ? durationRows.reduce((sum, r) => sum + (r.avg_duration || 0), 0)
      / durationRows.length / 60
    : DEFAULT_GAME_DURATION_MIN;
  const totalMinutes = avgDurationMin * agg.games;

  // 4. 최근 5경기 KDA (폼 추세)
  const recentRows = await db.select<RecentGameRow[]>(
    `SELECT pgs.kills, pgs.deaths, pgs.assists
    FROM player_game_stats pgs
    JOIN matches m ON m.id = pgs.match_id
    WHERE pgs.player_id = $1 ${seasonFilter}
    ORDER BY m.played_at DESC, pgs.match_id DESC
    LIMIT ${RECENT_GAMES_COUNT}`,
    params,
  );

  const recentKDA = calculateRecentKDA(recentRows);
  const overallKDA = calculateKDA(agg.total_kills, agg.total_deaths, agg.total_assists);
  const formTrend = determineFormTrend(recentKDA, overallKDA);

  return {
    playerId,
    // 경기당 평균
    avgKills: round2(safeDiv(agg.total_kills, agg.games)),
    avgDeaths: round2(safeDiv(agg.total_deaths, agg.games)),
    avgAssists: round2(safeDiv(agg.total_assists, agg.games)),
    avgCS: round2(safeDiv(agg.total_cs, agg.games)),
    avgGold: round2(safeDiv(agg.total_gold, agg.games)),
    avgDamage: round2(safeDiv(agg.total_damage, agg.games)),
    // 파생 메트릭
    kda: overallKDA,
    csPerMin: round2(safeDiv(agg.total_cs, totalMinutes)),
    goldPerMin: round2(safeDiv(agg.total_gold, totalMinutes)),
    damagePerMin: round2(safeDiv(agg.total_damage, totalMinutes)),
    killParticipation: round2(safeDiv(agg.total_kills + agg.total_assists, teamTotals.team_kills)),
    deathShare: round2(safeDiv(agg.total_deaths, teamTotals.team_deaths)),
    goldShare: round2(safeDiv(agg.total_gold, teamTotals.team_gold)),
    damageShare: round2(safeDiv(agg.total_damage, teamTotals.team_damage)),
    // 추세
    formTrend,
    recentKDA,
    totalGames: agg.games,
  };
}

/**
 * 팀 전체 선수 고급 통계
 */
export async function getTeamAdvancedStats(
  teamId: string,
  seasonId?: number,
): Promise<AdvancedPlayerStats[]> {
  const db = await getDatabase();
  const playerRows = await db.select<{ id: string }[]>(
    'SELECT id FROM players WHERE team_id = $1',
    [teamId],
  );

  const results: AdvancedPlayerStats[] = [];
  for (const row of playerRows) {
    const stats = await calculateAdvancedStats(row.id, seasonId);
    if (stats.totalGames > 0) {
      results.push(stats);
    }
  }

  return results.sort((a, b) => b.kda - a.kda);
}

/**
 * 리그 리더보드 — 특정 스탯 상위 선수 조회
 * @param stat AdvancedPlayerStats의 숫자 필드명
 * @param limit 상위 N명 (기본 10)
 * @param seasonId 시즌 ID (미지정 시 전체)
 */
export async function getLeagueLeaders(
  stat: keyof AdvancedPlayerStats,
  limit: number = 10,
  seasonId?: number,
): Promise<{ playerId: string; value: number }[]> {
  const db = await getDatabase();

  // 경기 기록이 있는 모든 선수 ID 조회
  const seasonFilter = seasonId != null
    ? 'AND m.season_id = $1'
    : '';
  const params: unknown[] = seasonId != null ? [seasonId] : [];

  const playerIdRows = await db.select<{ player_id: string }[]>(
    `SELECT DISTINCT pgs.player_id
    FROM player_game_stats pgs
    JOIN matches m ON m.id = pgs.match_id
    WHERE 1=1 ${seasonFilter}`,
    params,
  );

  const entries: { playerId: string; value: number }[] = [];

  for (const row of playerIdRows) {
    const stats = await calculateAdvancedStats(row.player_id, seasonId);
    const value = stats[stat];
    if (typeof value === 'number' && stats.totalGames >= 3) {
      entries.push({ playerId: row.player_id, value });
    }
  }

  entries.sort((a, b) => b.value - a.value);
  return entries.slice(0, limit);
}

// ─────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────

function calculateRecentKDA(rows: RecentGameRow[]): number {
  if (rows.length === 0) return 0;
  const totalKills = rows.reduce((s, r) => s + r.kills, 0);
  const totalDeaths = rows.reduce((s, r) => s + r.deaths, 0);
  const totalAssists = rows.reduce((s, r) => s + r.assists, 0);
  return calculateKDA(totalKills, totalDeaths, totalAssists);
}

function determineFormTrend(
  recentKDA: number,
  overallKDA: number,
): 'rising' | 'stable' | 'declining' {
  const diff = recentKDA - overallKDA;
  if (diff > TREND_THRESHOLD) return 'rising';
  if (diff < -TREND_THRESHOLD) return 'declining';
  return 'stable';
}

function createEmptyStats(playerId: string): AdvancedPlayerStats {
  return {
    playerId,
    avgKills: 0, avgDeaths: 0, avgAssists: 0,
    avgCS: 0, avgGold: 0, avgDamage: 0,
    kda: 0, csPerMin: 0, goldPerMin: 0, damagePerMin: 0,
    killParticipation: 0, deathShare: 0, goldShare: 0, damageShare: 0,
    formTrend: 'stable',
    recentKDA: 0,
    totalGames: 0,
  };
}
