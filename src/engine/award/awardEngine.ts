/**
 * 어워드 엔진
 * - 시즌 종료 시 어워드 산출 (MVP, All-Pro, 신인왕, 월간 MVP)
 * - 경기 MVP(POG) 기록
 * - 어워드 조회
 */

import type { Award, AwardType } from '../../types/award';
import type { Position } from '../../types/game';
import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface AwardRow {
  id: number;
  season_id: number;
  award_type: string;
  player_id: string | null;
  team_id: string | null;
  value: number | null;
  awarded_date: string;
}

interface PlayerStatsRow {
  player_id: string;
  player_name: string;
  team_id: string;
  position: string;
  age: number;
  games: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_cs: number;
  total_damage: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
}

interface TeamWinRow {
  team_id: string;
  wins: number;
  total_matches: number;
}

// ─────────────────────────────────────────
// Row → TypeScript 매핑
// ─────────────────────────────────────────

function mapAwardRow(row: AwardRow): Award {
  return {
    id: row.id,
    seasonId: row.season_id,
    awardType: row.award_type as AwardType,
    playerId: row.player_id,
    teamId: row.team_id,
    value: row.value,
    awardedDate: row.awarded_date,
  };
}

// ─────────────────────────────────────────
// 어워드 산출 (시즌 종료 시)
// ─────────────────────────────────────────

/**
 * 시즌 종료 시 전체 어워드 산출 및 DB 저장
 */
export async function calculateSeasonAwards(
  seasonId: number,
): Promise<Award[]> {
  const db = await getDatabase();
  const awardedDate = new Date().toISOString().split('T')[0];

  // 1. 선수별 시즌 통계 집계
  const playerStats = await db.select<PlayerStatsRow[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      pgs.position,
      p.age,
      COUNT(*) as games,
      SUM(pgs.kills) as total_kills,
      SUM(pgs.deaths) as total_deaths,
      SUM(pgs.assists) as total_assists,
      SUM(pgs.cs) as total_cs,
      SUM(pgs.damage_dealt) as total_damage,
      ROUND(AVG(pgs.kills), 1) as avg_kills,
      ROUND(AVG(pgs.deaths), 1) as avg_deaths,
      ROUND(AVG(pgs.assists), 1) as avg_assists
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    JOIN matches m ON m.id = pgs.match_id
    WHERE m.season_id = $1 AND m.match_type = 'regular'
    GROUP BY pgs.player_id
    HAVING games >= 3
    ORDER BY total_kills DESC`,
    [seasonId],
  );

  if (playerStats.length === 0) return [];

  // 2. 팀별 승률 (승리 기여도 계산용)
  const teamWins = await db.select<TeamWinRow[]>(
    `SELECT
      team_home_id as team_id,
      SUM(CASE WHEN score_home > score_away THEN 1 ELSE 0 END) as wins,
      COUNT(*) as total_matches
    FROM matches
    WHERE season_id = $1 AND match_type = 'regular' AND is_played = 1
    GROUP BY team_home_id
    UNION ALL
    SELECT
      team_away_id as team_id,
      SUM(CASE WHEN score_away > score_home THEN 1 ELSE 0 END) as wins,
      COUNT(*) as total_matches
    FROM matches
    WHERE season_id = $1 AND match_type = 'regular' AND is_played = 1
    GROUP BY team_away_id`,
    [seasonId],
  );

  // 팀 승률 맵
  const teamWinRateMap: Record<string, number> = {};
  const teamWinsAgg: Record<string, { wins: number; total: number }> = {};
  for (const tw of teamWins) {
    if (!teamWinsAgg[tw.team_id]) {
      teamWinsAgg[tw.team_id] = { wins: 0, total: 0 };
    }
    teamWinsAgg[tw.team_id].wins += tw.wins;
    teamWinsAgg[tw.team_id].total += tw.total_matches;
  }
  for (const [teamId, data] of Object.entries(teamWinsAgg)) {
    teamWinRateMap[teamId] = data.total > 0 ? data.wins / data.total : 0;
  }

  const awards: Award[] = [];

  // ─── MVP 산출 ───
  // MVP 점수 = KDA * 0.6 + 팀 승률 * 0.4
  const mvpScored = playerStats.map((ps) => {
    const kda = ps.total_deaths === 0
      ? ps.total_kills + ps.total_assists
      : (ps.total_kills + ps.total_assists) / ps.total_deaths;
    const winRate = teamWinRateMap[ps.team_id] ?? 0;
    const score = kda * 0.6 + winRate * 10 * 0.4;
    return { ...ps, kda, score };
  });
  mvpScored.sort((a, b) => b.score - a.score);

  if (mvpScored[0]) {
    const mvp = mvpScored[0];
    const mvpAward = await insertAward(db, {
      seasonId,
      awardType: 'mvp',
      playerId: mvp.player_id,
      teamId: mvp.team_id,
      value: Math.round(mvp.score * 100) / 100,
      awardedDate,
    });
    awards.push(mvpAward);

    // 수상 뉴스 생성
    try {
      const { generateAwardNews } = await import('../news/newsEngine');
      const playerRows = await db.select<{ name: string }[]>('SELECT name FROM players WHERE id = $1', [mvp.player_id]);
      const teamRows = await db.select<{ name: string }[]>('SELECT name FROM teams WHERE id = $1', [mvp.team_id]);
      await generateAwardNews(seasonId, awardedDate, playerRows[0]?.name ?? '', 'mvp', teamRows[0]?.name ?? '', mvp.team_id, mvp.player_id);
    } catch { /* 뉴스 생성 실패 무시 */ }
  }

  // ─── All-Pro 1st/2nd Team (포지션별) ───
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  for (const pos of positions) {
    const posPlayers = mvpScored.filter((ps) => ps.position === pos);
    if (posPlayers[0]) {
      const first = posPlayers[0];
      const award1 = await insertAward(db, {
        seasonId,
        awardType: 'all_pro_1st',
        playerId: first.player_id,
        teamId: first.team_id,
        value: Math.round(first.score * 100) / 100,
        awardedDate,
      });
      awards.push(award1);
    }
    if (posPlayers[1]) {
      const second = posPlayers[1];
      const award2 = await insertAward(db, {
        seasonId,
        awardType: 'all_pro_2nd',
        playerId: second.player_id,
        teamId: second.team_id,
        value: Math.round(second.score * 100) / 100,
        awardedDate,
      });
      awards.push(award2);
    }
  }

  // ─── 신인왕 (나이 ≤ 19 중 최고 성적) ───
  const rookies = mvpScored.filter((ps) => ps.age <= 19);
  if (rookies.length > 0) {
    const bestRookie = rookies[0];
    const rookieAward = await insertAward(db, {
      seasonId,
      awardType: 'rookie_of_year',
      playerId: bestRookie.player_id,
      teamId: bestRookie.team_id,
      value: Math.round(bestRookie.score * 100) / 100,
      awardedDate,
    });
    awards.push(rookieAward);
  }

  // ─── 월간 MVP (주차 구간별 최고 성과) ───
  // 주차를 4주 단위로 묶어 월간으로 처리
  const maxWeekRows = await db.select<{ max_week: number }[]>(
    `SELECT MAX(week) as max_week FROM matches
     WHERE season_id = $1 AND match_type = 'regular' AND is_played = 1`,
    [seasonId],
  );
  const maxWeek = maxWeekRows[0]?.max_week ?? 0;
  const monthSize = 4;

  for (let startWeek = 1; startWeek <= maxWeek; startWeek += monthSize) {
    const endWeek = Math.min(startWeek + monthSize - 1, maxWeek);

    const monthlyStats = await db.select<{
      player_id: string;
      team_id: string;
      total_kills: number;
      total_deaths: number;
      total_assists: number;
      games: number;
    }[]>(
      `SELECT
        pgs.player_id,
        pgs.team_id,
        SUM(pgs.kills) as total_kills,
        SUM(pgs.deaths) as total_deaths,
        SUM(pgs.assists) as total_assists,
        COUNT(*) as games
      FROM player_game_stats pgs
      JOIN matches m ON m.id = pgs.match_id
      WHERE m.season_id = $1 AND m.match_type = 'regular'
        AND m.week >= $2 AND m.week <= $3
      GROUP BY pgs.player_id
      HAVING games >= 2
      ORDER BY (SUM(pgs.kills) + SUM(pgs.assists)) * 1.0 / MAX(1, SUM(pgs.deaths)) DESC
      LIMIT 1`,
      [seasonId, startWeek, endWeek],
    );

    if (monthlyStats[0]) {
      const mp = monthlyStats[0];
      const kda = mp.total_deaths === 0
        ? mp.total_kills + mp.total_assists
        : (mp.total_kills + mp.total_assists) / mp.total_deaths;

      const monthAward = await insertAward(db, {
        seasonId,
        awardType: 'monthly_mvp',
        playerId: mp.player_id,
        teamId: mp.team_id,
        value: Math.round(kda * 100) / 100,
        awardedDate,
      });
      awards.push(monthAward);
    }
  }

  return awards;
}

// ─────────────────────────────────────────
// POG (경기 MVP) 기록
// ─────────────────────────────────────────

/**
 * 경기 MVP(POG) 기록
 */
export async function awardPOG(
  _gameId: string,
  _matchId: string,
  playerId: string,
  teamId: string,
  date: string,
  seasonId: number,
  value?: number,
): Promise<Award> {
  const db = await getDatabase();
  return insertAward(db, {
    seasonId,
    awardType: 'pog',
    playerId,
    teamId,
    value: value ?? null,
    awardedDate: date,
  });
}

// ─────────────────────────────────────────
// 어워드 조회
// ─────────────────────────────────────────

/**
 * 시즌 어워드 전체 조회
 */
export async function getAwardsBySeason(seasonId: number): Promise<Award[]> {
  const db = await getDatabase();
  const rows = await db.select<AwardRow[]>(
    `SELECT id, season_id, award_type, player_id, team_id, value, awarded_date
     FROM awards
     WHERE season_id = $1
     ORDER BY
       CASE award_type
         WHEN 'mvp' THEN 1
         WHEN 'rookie_of_year' THEN 2
         WHEN 'all_pro_1st' THEN 3
         WHEN 'all_pro_2nd' THEN 4
         WHEN 'monthly_mvp' THEN 5
         WHEN 'pog' THEN 6
       END,
       value DESC`,
    [seasonId],
  );
  return rows.map(mapAwardRow);
}

/**
 * 선수 개인 수상 이력 조회
 */
export async function getPlayerAwards(playerId: string): Promise<Award[]> {
  const db = await getDatabase();
  const rows = await db.select<AwardRow[]>(
    `SELECT id, season_id, award_type, player_id, team_id, value, awarded_date
     FROM awards
     WHERE player_id = $1
     ORDER BY season_id DESC, awarded_date DESC`,
    [playerId],
  );
  return rows.map(mapAwardRow);
}

/**
 * MVP 후보 순위 (시즌 진행 중 예측용)
 */
export async function getMvpCandidates(
  seasonId: number,
): Promise<{
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  kda: number;
  score: number;
  games: number;
}[]> {
  const db = await getDatabase();

  const playerStats = await db.select<{
    player_id: string;
    player_name: string;
    team_id: string;
    position: string;
    games: number;
    total_kills: number;
    total_deaths: number;
    total_assists: number;
  }[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      pgs.position,
      COUNT(*) as games,
      SUM(pgs.kills) as total_kills,
      SUM(pgs.deaths) as total_deaths,
      SUM(pgs.assists) as total_assists
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    JOIN matches m ON m.id = pgs.match_id
    WHERE m.season_id = $1 AND m.match_type = 'regular'
    GROUP BY pgs.player_id
    HAVING games >= 2
    ORDER BY (SUM(pgs.kills) + SUM(pgs.assists)) * 1.0 / MAX(1, SUM(pgs.deaths)) DESC`,
    [seasonId],
  );

  // 팀 승률
  const teamWins = await db.select<TeamWinRow[]>(
    `SELECT
      team_home_id as team_id,
      SUM(CASE WHEN score_home > score_away THEN 1 ELSE 0 END) as wins,
      COUNT(*) as total_matches
    FROM matches
    WHERE season_id = $1 AND match_type = 'regular' AND is_played = 1
    GROUP BY team_home_id
    UNION ALL
    SELECT
      team_away_id as team_id,
      SUM(CASE WHEN score_away > score_home THEN 1 ELSE 0 END) as wins,
      COUNT(*) as total_matches
    FROM matches
    WHERE season_id = $1 AND match_type = 'regular' AND is_played = 1
    GROUP BY team_away_id`,
    [seasonId],
  );

  const teamWinRateMap: Record<string, number> = {};
  const teamWinsAgg: Record<string, { wins: number; total: number }> = {};
  for (const tw of teamWins) {
    if (!teamWinsAgg[tw.team_id]) {
      teamWinsAgg[tw.team_id] = { wins: 0, total: 0 };
    }
    teamWinsAgg[tw.team_id].wins += tw.wins;
    teamWinsAgg[tw.team_id].total += tw.total_matches;
  }
  for (const [teamId, data] of Object.entries(teamWinsAgg)) {
    teamWinRateMap[teamId] = data.total > 0 ? data.wins / data.total : 0;
  }

  return playerStats.map((ps) => {
    const kda = ps.total_deaths === 0
      ? ps.total_kills + ps.total_assists
      : (ps.total_kills + ps.total_assists) / ps.total_deaths;
    const winRate = teamWinRateMap[ps.team_id] ?? 0;
    const score = kda * 0.6 + winRate * 10 * 0.4;
    return {
      playerId: ps.player_id,
      playerName: ps.player_name,
      teamId: ps.team_id,
      position: ps.position,
      kda: Math.round(kda * 100) / 100,
      score: Math.round(score * 100) / 100,
      games: ps.games,
    };
  }).sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────

async function insertAward(
  db: Awaited<ReturnType<typeof getDatabase>>,
  params: {
    seasonId: number;
    awardType: AwardType;
    playerId: string | null;
    teamId: string | null;
    value: number | null;
    awardedDate: string;
  },
): Promise<Award> {
  const result = await db.execute(
    `INSERT INTO awards (season_id, award_type, player_id, team_id, value, awarded_date)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.seasonId, params.awardType, params.playerId, params.teamId, params.value, params.awardedDate],
  );

  return {
    id: result.lastInsertId as number,
    seasonId: params.seasonId,
    awardType: params.awardType as AwardType,
    playerId: params.playerId,
    teamId: params.teamId,
    value: params.value,
    awardedDate: params.awardedDate,
  };
}
