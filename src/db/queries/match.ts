/**
 * 매치 CRUD, 게임 결과, 선수 경기 스탯
 */
import type { Match, PlayerGameStats } from '../../types/match';
import { getDatabase } from '../database';

// ─────────────────────────────────────────
// Row → TypeScript 매핑
// ─────────────────────────────────────────

interface MatchRow {
  id: string;
  season_id: number;
  week: number;
  match_date: string | null;
  team_home_id: string;
  team_away_id: string;
  score_home: number;
  score_away: number;
  is_played: boolean;
  played_at: string | null;
  match_type: string;
  bo_format: string;
  fearless_draft: boolean | number;
}

export function mapRowToMatch(row: MatchRow): Match {
  return {
    id: row.id,
    seasonId: row.season_id,
    week: row.week,
    matchDate: row.match_date ?? undefined,
    teamHomeId: row.team_home_id,
    teamAwayId: row.team_away_id,
    scoreHome: row.score_home,
    scoreAway: row.score_away,
    isPlayed: Boolean(row.is_played),
    playedAt: row.played_at ?? undefined,
    games: [],
    matchType: (row.match_type ?? 'regular') as Match['matchType'],
    boFormat: (row.bo_format ?? 'Bo3') as Match['boFormat'],
    fearlessDraft: Boolean(row.fearless_draft),
  };
}

// ─────────────────────────────────────────
// 매치 CRUD
// ─────────────────────────────────────────

export async function insertMatch(match: {
  id: string;
  seasonId: number;
  week: number;
  teamHomeId: string;
  teamAwayId: string;
  matchDate?: string;
  matchType?: string;
  boFormat?: string;
  fearlessDraft?: boolean;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO matches (id, season_id, week, team_home_id, team_away_id, match_date, match_type, bo_format, fearless_draft)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [match.id, match.seasonId, match.week, match.teamHomeId, match.teamAwayId,
     match.matchDate ?? null, match.matchType ?? 'regular', match.boFormat ?? 'Bo3',
     match.fearlessDraft ?? false],
  );
}

/** 경기 ID로 단일 경기 조회 */
export async function getMatchById(matchId: string): Promise<Match | null> {
  const db = await getDatabase();
  const rows = await db.select<MatchRow[]>(
    'SELECT * FROM matches WHERE id = $1',
    [matchId],
  );
  return rows.length > 0 ? mapRowToMatch(rows[0]) : null;
}

/** 시즌 전체 경기 조회 */
export async function getMatchesBySeason(seasonId: number): Promise<Match[]> {
  const db = await getDatabase();
  const rows = await db.select<MatchRow[]>(
    'SELECT * FROM matches WHERE season_id = $1 ORDER BY week, id',
    [seasonId],
  );
  return rows.map(mapRowToMatch);
}

/** 특정 주차 경기 조회 */
export async function getMatchesByWeek(seasonId: number, week: number): Promise<Match[]> {
  const db = await getDatabase();
  const rows = await db.select<MatchRow[]>(
    'SELECT * FROM matches WHERE season_id = $1 AND week = $2 ORDER BY id',
    [seasonId, week],
  );
  return rows.map(mapRowToMatch);
}

/** 특정 팀의 시즌 경기 조회 */
export async function getMatchesByTeam(seasonId: number, teamId: string): Promise<Match[]> {
  const db = await getDatabase();
  const rows = await db.select<MatchRow[]>(
    'SELECT * FROM matches WHERE season_id = $1 AND (team_home_id = $2 OR team_away_id = $2) ORDER BY week',
    [seasonId, teamId],
  );
  return rows.map(mapRowToMatch);
}

/** 특정 날짜의 경기 조회 */
export async function getMatchesByDate(seasonId: number, date: string): Promise<Match[]> {
  const db = await getDatabase();
  const rows = await db.select<MatchRow[]>(
    'SELECT * FROM matches WHERE season_id = $1 AND match_date = $2 ORDER BY id',
    [seasonId, date],
  );
  return rows.map(mapRowToMatch);
}

/** 경기 결과 업데이트 */
export async function updateMatchResult(
  matchId: string,
  scoreHome: number,
  scoreAway: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE matches SET score_home = $1, score_away = $2, is_played = TRUE, played_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [scoreHome, scoreAway, matchId],
  );
}

/** 리그 순위 계산 (승/패/세트득실) */
export async function getStandings(seasonId: number): Promise<{
  teamId: string;
  wins: number;
  losses: number;
  setWins: number;
  setLosses: number;
}[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    team_id: string;
    wins: number;
    losses: number;
    set_wins: number;
    set_losses: number;
  }[]>(
    `SELECT
      t.id as team_id,
      COALESCE(w.wins, 0) as wins,
      COALESCE(l.losses, 0) as losses,
      COALESCE(w.set_wins, 0) as set_wins,
      COALESCE(l.set_losses, 0) as set_losses
    FROM teams t
    LEFT JOIN (
      SELECT
        CASE WHEN score_home > score_away THEN team_home_id ELSE team_away_id END as tid,
        COUNT(*) as wins,
        SUM(CASE WHEN score_home > score_away THEN score_home ELSE score_away END) as set_wins
      FROM matches WHERE season_id = $1 AND is_played = TRUE AND match_type = 'regular'
        AND score_home <> score_away
      GROUP BY tid
    ) w ON t.id = w.tid
    LEFT JOIN (
      SELECT
        CASE WHEN score_home < score_away THEN team_home_id ELSE team_away_id END as tid,
        COUNT(*) as losses,
        SUM(CASE WHEN score_home < score_away THEN score_home ELSE score_away END) as set_losses
      FROM matches WHERE season_id = $1 AND is_played = TRUE AND match_type = 'regular'
        AND score_home <> score_away
      GROUP BY tid
    ) l ON t.id = l.tid
    WHERE EXISTS (
      SELECT 1 FROM matches m WHERE m.season_id = $1
        AND (m.team_home_id = t.id OR m.team_away_id = t.id)
    )
    ORDER BY wins DESC,
      (COALESCE(w.set_wins, 0) - COALESCE(l.set_losses, 0)) DESC,
      COALESCE(w.set_wins, 0) DESC`,
    [seasonId],
  );

  return rows.map(r => ({
    teamId: r.team_id,
    wins: r.wins,
    losses: r.losses,
    setWins: r.set_wins,
    setLosses: r.set_losses,
  }));
}

/** 개별 게임(세트) 결과 저장 */
export async function insertGameResult(
  gameId: string,
  matchId: string,
  gameNumber: number,
  winnerTeamId: string,
  durationSeconds: number,
  goldDiffAt15: number,
  totalKillsHome: number,
  totalKillsAway: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO games (id, match_id, game_number, winner_team_id, duration_seconds, gold_diff_at_15, total_kills_home, total_kills_away)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [gameId, matchId, gameNumber, winnerTeamId, durationSeconds, goldDiffAt15, totalKillsHome, totalKillsAway],
  );
}

// ─────────────────────────────────────────
// 게임(세트) 통계 조회
// ─────────────────────────────────────────

export interface GameRow {
  id: string;
  match_id: string;
  game_number: number;
  winner_team_id: string | null;
  duration_seconds: number | null;
  gold_diff_at_15: number;
  total_kills_home: number;
  total_kills_away: number;
}

/** 특정 팀의 시즌 전체 게임(세트) 조회 */
export async function getGamesByTeamSeason(
  seasonId: number,
  teamId: string,
): Promise<GameRow[]> {
  const db = await getDatabase();
  const rows = await db.select<GameRow[]>(
    `SELECT g.* FROM games g
     JOIN matches m ON m.id = g.match_id
     WHERE m.season_id = $1
       AND (m.team_home_id = $2 OR m.team_away_id = $2)
       AND m.is_played = TRUE
     ORDER BY m.week, g.game_number`,
    [seasonId, teamId],
  );
  return rows;
}

// ─────────────────────────────────────────
// 선수 개인 경기 스탯 (player_game_stats)
// ─────────────────────────────────────────

interface PlayerGameStatsRow {
  id: string;
  game_id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  side: string;
  position: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold_earned: number;
  damage_dealt: number;
}

function mapRowToPlayerGameStats(row: PlayerGameStatsRow): PlayerGameStats {
  return {
    id: row.id,
    gameId: row.game_id,
    matchId: row.match_id,
    playerId: row.player_id,
    teamId: row.team_id,
    side: row.side as 'home' | 'away',
    position: row.position,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    cs: row.cs,
    goldEarned: row.gold_earned,
    damageDealt: row.damage_dealt,
  };
}

/** 선수 경기 스탯 배치 INSERT */
export async function insertPlayerGameStats(
  stats: PlayerGameStats[],
): Promise<void> {
  if (stats.length === 0) return;
  const db = await getDatabase();

  for (const s of stats) {
    await db.execute(
      `INSERT INTO player_game_stats (id, game_id, match_id, player_id, team_id, side, position, kills, deaths, assists, cs, gold_earned, damage_dealt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [s.id, s.gameId, s.matchId, s.playerId, s.teamId, s.side, s.position, s.kills, s.deaths, s.assists, s.cs, s.goldEarned, s.damageDealt],
    );
  }
}

/** 선수별 경기 기록 조회 */
export async function getPlayerGameStatsByPlayer(
  playerId: string,
  limit = 20,
): Promise<PlayerGameStats[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerGameStatsRow[]>(
    `SELECT pgs.* FROM player_game_stats pgs
     JOIN matches m ON m.id = pgs.match_id
     WHERE pgs.player_id = $1
     ORDER BY m.match_date DESC, pgs.game_id DESC
     LIMIT $2`,
    [playerId, limit],
  );
  return rows.map(mapRowToPlayerGameStats);
}

/** 시즌 개인 순위 (SUM/AVG 집계) */
export async function getSeasonPlayerRankings(
  seasonId: number,
): Promise<{
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  games: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalCs: number;
  totalDamage: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgCs: number;
  avgDamage: number;
}[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    player_id: string;
    player_name: string;
    team_id: string;
    position: string;
    games: number;
    total_kills: number;
    total_deaths: number;
    total_assists: number;
    total_cs: number;
    total_damage: number;
    avg_kills: number;
    avg_deaths: number;
    avg_assists: number;
    avg_cs: number;
    avg_damage: number;
  }[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      pgs.position,
      COUNT(*) as games,
      SUM(pgs.kills) as total_kills,
      SUM(pgs.deaths) as total_deaths,
      SUM(pgs.assists) as total_assists,
      SUM(pgs.cs) as total_cs,
      SUM(pgs.damage_dealt) as total_damage,
      ROUND(AVG(pgs.kills), 1) as avg_kills,
      ROUND(AVG(pgs.deaths), 1) as avg_deaths,
      ROUND(AVG(pgs.assists), 1) as avg_assists,
      ROUND(AVG(pgs.cs), 0) as avg_cs,
      ROUND(AVG(pgs.damage_dealt), 0) as avg_damage
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    JOIN matches m ON m.id = pgs.match_id
    WHERE m.season_id = $1
    GROUP BY pgs.player_id
    ORDER BY total_kills DESC`,
    [seasonId],
  );
  return rows.map(r => ({
    playerId: r.player_id,
    playerName: r.player_name,
    teamId: r.team_id,
    position: r.position,
    games: r.games,
    totalKills: r.total_kills,
    totalDeaths: r.total_deaths,
    totalAssists: r.total_assists,
    totalCs: r.total_cs,
    totalDamage: r.total_damage,
    avgKills: r.avg_kills,
    avgDeaths: r.avg_deaths,
    avgAssists: r.avg_assists,
    avgCs: r.avg_cs,
    avgDamage: r.avg_damage,
  }));
}
