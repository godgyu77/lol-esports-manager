/**
 * 심화 통계 엔진
 * - advancedStatsEngine를 보완하는 상세 통계
 * - 15분 골드차, 퍼스트블러드율, 라인전 승률 등 심화 메트릭
 * - 팀 상세 통계 (게임 시간대별 레이팅, 사이드 승률)
 */

import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface DetailedPlayerStats {
  // 기본
  kda: number;
  csPerMin: number;
  goldPerMin: number;
  damagePerMin: number;
  killParticipation: number;
  // 심화
  goldDiffAt15: number;
  csDiffAt15: number;
  firstBloodRate: number;
  soloKillRate: number;
  wardScore: number;
  objectiveControl: number;
  teamfightDamageShare: number;
  laneWinRate: number;
  clutchFactor: number;
  consistencyScore: number;
  totalGames: number;
}

export interface TeamDetailedStats {
  averageGameDuration: number;
  firstBloodRate: number;
  dragonControlRate: number;
  baronControlRate: number;
  earlyGameRating: number;
  midGameRating: number;
  lateGameRating: number;
  comebackRate: number;
  blueWinRate: number;
  redWinRate: number;
  totalGames: number;
}

export interface PlayerRankingEntry {
  playerId: string;
  name: string;
  value: number;
}

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface PlayerAggRow {
  games: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_cs: number;
  total_gold: number;
  total_damage: number;
}

interface TeamAggRow {
  team_kills: number;
}

interface GameDetailRow {
  gold_diff_at_15: number;
  first_blood_team: string | null;
  duration_seconds: number;
  total_kills_home: number;
  total_kills_away: number;
  dragon_kills_home: number;
  dragon_kills_away: number;
  baron_kills_home: number;
  baron_kills_away: number;
  is_home: number;
  winner: string | null;
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function safeDiv(n: number, d: number, fallback = 0): number {
  return d > 0 ? n / d : fallback;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** 표준편차 기반 일관성 점수 (0-100, 높을수록 일관적) */
function calcConsistencyScore(values: number[]): number {
  if (values.length < 2) return 50;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  // stdev를 0-100 범위로 역변환 (stdev가 낮으면 점수 높음)
  const normalized = Math.max(0, 100 - stdev * 10);
  return Math.round(normalized);
}

const DEFAULT_GAME_DURATION_MIN = 30;

// ─────────────────────────────────────────
// 선수 상세 통계
// ─────────────────────────────────────────

export async function getDetailedPlayerStats(
  playerId: string,
  seasonId: number,
): Promise<DetailedPlayerStats> {
  try {
    const db = await getDatabase();

    // 1. 기본 집계
    const aggRows = await db.select<PlayerAggRow[]>(
      `SELECT
        COUNT(*) as games,
        COALESCE(SUM(pgs.kills), 0) as total_kills,
        COALESCE(SUM(pgs.deaths), 0) as total_deaths,
        COALESCE(SUM(pgs.assists), 0) as total_assists,
        COALESCE(SUM(pgs.cs), 0) as total_cs,
        COALESCE(SUM(pgs.gold_earned), 0) as total_gold,
        COALESCE(SUM(pgs.damage_dealt), 0) as total_damage
      FROM player_game_stats pgs
      JOIN matches m ON m.id = pgs.match_id
      WHERE pgs.player_id = $1 AND m.season_id = $2`,
      [playerId, seasonId],
    );

    const agg = aggRows[0];
    if (!agg || agg.games === 0) return createEmptyDetailedStats();

    // 2. 팀 총 킬 (kill participation 계산용)
    const teamAgg = await db.select<TeamAggRow[]>(
      `SELECT COALESCE(SUM(pgs2.kills), 0) as team_kills
       FROM player_game_stats pgs2
       WHERE pgs2.team_id = (SELECT team_id FROM players WHERE id = $1)
         AND pgs2.match_id IN (
           SELECT DISTINCT pgs3.match_id FROM player_game_stats pgs3
           JOIN matches m2 ON m2.id = pgs3.match_id
           WHERE pgs3.player_id = $1 AND m2.season_id = $2
         )`,
      [playerId, seasonId],
    );
    const teamKills = teamAgg[0]?.team_kills ?? 1;

    // 3. 게임 상세 (15분 골드차, 퍼블 등)
    const gameDetails = await db.select<GameDetailRow[]>(
      `SELECT
        g.gold_diff_at_15,
        g.first_blood_team,
        g.duration_seconds,
        g.total_kills_home,
        g.total_kills_away,
        COALESCE(g.dragon_kills_home, 0) as dragon_kills_home,
        COALESCE(g.dragon_kills_away, 0) as dragon_kills_away,
        COALESCE(g.baron_kills_home, 0) as baron_kills_home,
        COALESCE(g.baron_kills_away, 0) as baron_kills_away,
        CASE WHEN m.team_home_id = (SELECT team_id FROM players WHERE id = $1) THEN 1 ELSE 0 END as is_home,
        g.winner
      FROM games g
      JOIN matches m ON m.id = g.match_id
      WHERE m.season_id = $2
        AND m.id IN (SELECT DISTINCT match_id FROM player_game_stats WHERE player_id = $1)
      ORDER BY g.id`,
      [playerId, seasonId],
    );

    // 4. 평균 게임 시간
    const avgDurationSec = gameDetails.length > 0
      ? gameDetails.reduce((s, g) => s + (g.duration_seconds || 1800), 0) / gameDetails.length
      : DEFAULT_GAME_DURATION_MIN * 60;
    const totalMinutes = (avgDurationSec / 60) * agg.games;

    // 5. 15분 골드차 (팀 관점)
    const goldDiffAt15Values = gameDetails
      .filter(g => g.gold_diff_at_15 != null)
      .map(g => g.is_home ? g.gold_diff_at_15 : -g.gold_diff_at_15);
    const avgGoldDiffAt15 = goldDiffAt15Values.length > 0
      ? Math.round(goldDiffAt15Values.reduce((a, b) => a + b, 0) / goldDiffAt15Values.length)
      : 0;

    // 6. 퍼스트 블러드 획득률
    const playerTeamId = await db.select<{ team_id: string }[]>(
      'SELECT team_id FROM players WHERE id = $1',
      [playerId],
    );
    const teamId = playerTeamId[0]?.team_id ?? '';
    const fbGames = gameDetails.filter(g => g.first_blood_team != null);
    const fbWins = fbGames.filter(g => g.first_blood_team === teamId).length;
    const firstBloodRate = fbGames.length > 0 ? round2((fbWins / fbGames.length) * 100) : 50;

    // 7. 라인전 승률 (15분 골드 이득 비율)
    const laneWins = goldDiffAt15Values.filter(d => d > 0).length;
    const laneWinRate = goldDiffAt15Values.length > 0
      ? round2((laneWins / goldDiffAt15Values.length) * 100)
      : 50;

    // 8. 경기별 KDA로 일관성 계산
    const perGameKdas = await db.select<{ kills: number; deaths: number; assists: number }[]>(
      `SELECT kills, deaths, assists FROM player_game_stats pgs
       JOIN matches m ON m.id = pgs.match_id
       WHERE pgs.player_id = $1 AND m.season_id = $2`,
      [playerId, seasonId],
    );
    const kdaValues = perGameKdas.map(g =>
      g.deaths === 0 ? g.kills + g.assists : (g.kills + g.assists) / g.deaths,
    );
    const consistencyScore = calcConsistencyScore(kdaValues);

    // 9. 추정치 (DB에 없는 스탯)
    const soloKillRate = round2(Math.random() * 15 + 5); // 5-20%
    const wardScore = round2(Math.random() * 30 + 15); // 15-45
    const objectiveControl = round2(Math.random() * 30 + 40); // 40-70%
    const teamfightDamageShare = round2(safeDiv(agg.total_damage, agg.total_damage * 5) * 100 + (Math.random() * 10 - 5));
    const clutchFactor = Math.round(Math.random() * 30 + 35); // 35-65
    const csDiffAt15 = Math.round(avgGoldDiffAt15 / 50); // 골드차에서 추정

    return {
      kda: agg.total_deaths === 0
        ? agg.total_kills + agg.total_assists
        : round2((agg.total_kills + agg.total_assists) / agg.total_deaths),
      csPerMin: round2(safeDiv(agg.total_cs, totalMinutes)),
      goldPerMin: round2(safeDiv(agg.total_gold, totalMinutes)),
      damagePerMin: round2(safeDiv(agg.total_damage, totalMinutes)),
      killParticipation: round2(safeDiv(agg.total_kills + agg.total_assists, teamKills) * 100),
      goldDiffAt15: avgGoldDiffAt15,
      csDiffAt15,
      firstBloodRate,
      soloKillRate,
      wardScore,
      objectiveControl,
      teamfightDamageShare: Math.min(40, Math.max(10, teamfightDamageShare)),
      laneWinRate,
      clutchFactor,
      consistencyScore,
      totalGames: agg.games,
    };
  } catch (e) {
    console.warn('[detailedStatsEngine] getDetailedPlayerStats failed:', e);
    return createEmptyDetailedStats();
  }
}

// ─────────────────────────────────────────
// 팀 상세 통계
// ─────────────────────────────────────────

export async function getTeamDetailedStats(
  teamId: string,
  seasonId: number,
): Promise<TeamDetailedStats> {
  try {
    const db = await getDatabase();

    const gameRows = await db.select<GameDetailRow[]>(
      `SELECT
        g.gold_diff_at_15,
        g.first_blood_team,
        g.duration_seconds,
        g.total_kills_home,
        g.total_kills_away,
        COALESCE(g.dragon_kills_home, 0) as dragon_kills_home,
        COALESCE(g.dragon_kills_away, 0) as dragon_kills_away,
        COALESCE(g.baron_kills_home, 0) as baron_kills_home,
        COALESCE(g.baron_kills_away, 0) as baron_kills_away,
        CASE WHEN m.team_home_id = $1 THEN 1 ELSE 0 END as is_home,
        g.winner
      FROM games g
      JOIN matches m ON m.id = g.match_id
      WHERE m.season_id = $2 AND m.is_played = 1
        AND (m.team_home_id = $1 OR m.team_away_id = $1)
      ORDER BY g.id`,
      [teamId, seasonId],
    );

    if (gameRows.length === 0) return createEmptyTeamStats();

    const totalGames = gameRows.length;

    // 평균 게임 시간
    const totalDuration = gameRows.reduce((s, g) => s + (g.duration_seconds || 1800), 0);
    const averageGameDuration = Math.round(totalDuration / totalGames);

    // 퍼스트 블러드율
    const fbGames = gameRows.filter(g => g.first_blood_team != null);
    const fbWins = fbGames.filter(g => g.first_blood_team === teamId).length;
    const firstBloodRate = fbGames.length > 0 ? round2((fbWins / fbGames.length) * 100) : 50;

    // 드래곤/바론 컨트롤율
    let totalDragons = 0;
    let teamDragons = 0;
    let totalBarons = 0;
    let teamBarons = 0;
    for (const g of gameRows) {
      const myDragons = g.is_home ? g.dragon_kills_home : g.dragon_kills_away;
      const oppDragons = g.is_home ? g.dragon_kills_away : g.dragon_kills_home;
      teamDragons += myDragons;
      totalDragons += myDragons + oppDragons;

      const myBarons = g.is_home ? g.baron_kills_home : g.baron_kills_away;
      const oppBarons = g.is_home ? g.baron_kills_away : g.baron_kills_home;
      teamBarons += myBarons;
      totalBarons += myBarons + oppBarons;
    }
    const dragonControlRate = round2(safeDiv(teamDragons, totalDragons, 0.5) * 100);
    const baronControlRate = round2(safeDiv(teamBarons, totalBarons, 0.5) * 100);

    // 15분 기준 골드차 → 초반 레이팅
    const goldDiffs = gameRows
      .filter(g => g.gold_diff_at_15 != null)
      .map(g => g.is_home ? g.gold_diff_at_15 : -g.gold_diff_at_15);
    const avgGoldDiff = goldDiffs.length > 0
      ? goldDiffs.reduce((a, b) => a + b, 0) / goldDiffs.length
      : 0;
    // 초반 레이팅: 골드차 기반 0-100 변환
    const earlyGameRating = Math.round(Math.min(100, Math.max(0, 50 + avgGoldDiff / 100)));

    // 승리 분리 → 게임 시간 기반 레이팅
    const wins = gameRows.filter(g => {
      if (g.is_home) return g.winner === 'home';
      return g.winner === 'away';
    });

    // 후반 레이팅: 긴 게임 승률
    const lateGames = gameRows.filter(g => (g.duration_seconds || 1800) > 2100); // 35분+
    const lateWins = lateGames.filter(g => {
      if (g.is_home) return g.winner === 'home';
      return g.winner === 'away';
    });
    const lateGameRating = lateGames.length >= 2
      ? Math.round(safeDiv(lateWins.length, lateGames.length) * 100)
      : 50;

    // 중반 레이팅: 전체 승률과 초반/후반의 평균
    const overallWinRate = safeDiv(wins.length, totalGames) * 100;
    const midGameRating = Math.round((earlyGameRating + lateGameRating + overallWinRate) / 3);

    // 역전률 (골드 뒤질 때 이긴 비율)
    const behindGames = goldDiffs.filter(d => d < -500);
    const comebackWins = gameRows.filter((g, i) => {
      const gd = goldDiffs[i];
      if (gd == null || gd >= -500) return false;
      if (g.is_home) return g.winner === 'home';
      return g.winner === 'away';
    });
    const comebackRate = behindGames.length >= 2
      ? round2(safeDiv(comebackWins.length, behindGames.length) * 100)
      : 30;

    // 사이드 승률
    const blueGames = gameRows.filter(g => g.is_home);
    const blueWins = blueGames.filter(g => g.winner === 'home');
    const redGames = gameRows.filter(g => !g.is_home);
    const redWins = redGames.filter(g => g.winner === 'away');

    const blueWinRate = blueGames.length > 0
      ? round2(safeDiv(blueWins.length, blueGames.length) * 100) : 50;
    const redWinRate = redGames.length > 0
      ? round2(safeDiv(redWins.length, redGames.length) * 100) : 50;

    return {
      averageGameDuration,
      firstBloodRate,
      dragonControlRate,
      baronControlRate,
      earlyGameRating,
      midGameRating,
      lateGameRating,
      comebackRate,
      blueWinRate,
      redWinRate,
      totalGames,
    };
  } catch (e) {
    console.warn('[detailedStatsEngine] getTeamDetailedStats failed:', e);
    return createEmptyTeamStats();
  }
}

// ─────────────────────────────────────────
// 리그 순위
// ─────────────────────────────────────────

type RankingStat = 'kda' | 'csPerMin' | 'goldPerMin' | 'damagePerMin' | 'killParticipation' | 'goldDiffAt15' | 'laneWinRate' | 'consistencyScore';

export async function getPlayerRanking(
  seasonId: number,
  stat: RankingStat,
  limit = 10,
): Promise<PlayerRankingEntry[]> {
  try {
    const db = await getDatabase();

    // 경기 기록 있는 선수 조회
    const playerRows = await db.select<{ player_id: string; name: string }[]>(
      `SELECT DISTINCT pgs.player_id, p.name
       FROM player_game_stats pgs
       JOIN matches m ON m.id = pgs.match_id
       JOIN players p ON p.id = pgs.player_id
       WHERE m.season_id = $1`,
      [seasonId],
    );

    const entries: PlayerRankingEntry[] = [];

    for (const row of playerRows) {
      const stats = await getDetailedPlayerStats(row.player_id, seasonId);
      if (stats.totalGames < 3) continue;

      const value = stats[stat];
      if (typeof value === 'number') {
        entries.push({ playerId: row.player_id, name: row.name, value: round2(value) });
      }
    }

    entries.sort((a, b) => b.value - a.value);
    return entries.slice(0, limit);
  } catch (e) {
    console.warn('[detailedStatsEngine] getPlayerRanking failed:', e);
    return [];
  }
}

// ─────────────────────────────────────────
// Empty 팩토리
// ─────────────────────────────────────────

function createEmptyDetailedStats(): DetailedPlayerStats {
  return {
    kda: 0, csPerMin: 0, goldPerMin: 0, damagePerMin: 0, killParticipation: 0,
    goldDiffAt15: 0, csDiffAt15: 0, firstBloodRate: 0, soloKillRate: 0,
    wardScore: 0, objectiveControl: 0, teamfightDamageShare: 0,
    laneWinRate: 0, clutchFactor: 0, consistencyScore: 0, totalGames: 0,
  };
}

function createEmptyTeamStats(): TeamDetailedStats {
  return {
    averageGameDuration: 0, firstBloodRate: 0, dragonControlRate: 0,
    baronControlRate: 0, earlyGameRating: 0, midGameRating: 0,
    lateGameRating: 0, comebackRate: 0, blueWinRate: 0, redWinRate: 0,
    totalGames: 0,
  };
}
