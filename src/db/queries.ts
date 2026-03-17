/**
 * DB CRUD 함수 — @tauri-apps/plugin-sql 기반
 * snake_case DB row ↔ camelCase TypeScript 객체 매핑 포함
 */
import type { GameMode, GameSave, Position, Region, Season, Split } from '../types';
import type { Champion } from '../types/champion';
import type { Match } from '../types/match';
import type { ChampionProficiency, Player, PlayerContract, PlayerMental, PlayerStats } from '../types/player';
import type { Team } from '../types/team';
import { getDatabase } from './database';

// ─────────────────────────────────────────
// Row → TypeScript 매핑 유틸
// ─────────────────────────────────────────

interface PlayerRow {
  id: string;
  name: string;
  team_id: string | null;
  position: Position;
  age: number;
  nationality: string;
  mechanical: number;
  game_sense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
  mental: number;
  stamina: number;
  morale: number;
  salary: number;
  contract_end_season: number;
  potential: number;
  peak_age: number;
  popularity: number;
  division: string;
  is_user_player: boolean;
}

interface TeamRow {
  id: string;
  name: string;
  short_name: string;
  region: Region;
  budget: number;
  salary_cap: number;
  reputation: number;
}

interface SeasonRow {
  id: number;
  year: number;
  split: Split;
  current_week: number;
  current_date: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface SaveRow {
  id: number;
  mode: GameMode;
  user_team_id: string;
  user_player_id: string | null;
  current_season_id: number;
  created_at: string;
  updated_at: string;
}

export function mapRowToPlayer(row: PlayerRow): Player & { division: string } {
  const stats: PlayerStats = {
    mechanical: row.mechanical,
    gameSense: row.game_sense,
    teamwork: row.teamwork,
    consistency: row.consistency,
    laning: row.laning,
    aggression: row.aggression,
  };

  const mental: PlayerMental = {
    mental: row.mental,
    stamina: row.stamina,
    morale: row.morale,
  };

  const contract: PlayerContract = {
    salary: row.salary,
    contractEndSeason: row.contract_end_season,
  };

  return {
    id: row.id,
    name: row.name,
    teamId: row.team_id,
    position: row.position,
    age: row.age,
    nationality: row.nationality,
    stats,
    mental,
    contract,
    championPool: [],
    potential: row.potential,
    peakAge: row.peak_age,
    popularity: row.popularity,
    division: row.division,
  };
}

export function mapRowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    region: row.region,
    budget: row.budget,
    salaryCap: row.salary_cap,
    reputation: row.reputation,
    roster: [],
  };
}

export function mapRowToSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    year: row.year,
    split: row.split,
    currentWeek: row.current_week,
    currentDate: row.current_date,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: Boolean(row.is_active),
  };
}

export function mapRowToSave(row: SaveRow): GameSave {
  return {
    id: row.id,
    mode: row.mode,
    userTeamId: row.user_team_id,
    userPlayerId: row.user_player_id ?? undefined,
    currentSeasonId: row.current_season_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────────────────
// 팀 CRUD
// ─────────────────────────────────────────

export async function insertTeam(team: {
  id: string;
  name: string;
  shortName: string;
  region: Region;
  budget: number;
  salaryCap: number;
  reputation: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO teams (id, name, short_name, region, budget, salary_cap, reputation)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [team.id, team.name, team.shortName, team.region, team.budget, team.salaryCap, team.reputation],
  );
}

export async function getAllTeams(): Promise<Team[]> {
  const db = await getDatabase();
  const rows = await db.select<TeamRow[]>('SELECT * FROM teams');
  return rows.map(mapRowToTeam);
}

export async function getTeamsByRegion(region: Region): Promise<Team[]> {
  const db = await getDatabase();
  const rows = await db.select<TeamRow[]>('SELECT * FROM teams WHERE region = $1', [region]);
  return rows.map(mapRowToTeam);
}

export async function getTeamWithRoster(teamId: string): Promise<Team | null> {
  const db = await getDatabase();
  const teamRows = await db.select<TeamRow[]>('SELECT * FROM teams WHERE id = $1', [teamId]);
  if (teamRows.length === 0) return null;

  const team = mapRowToTeam(teamRows[0]);
  const playerRows = await db.select<PlayerRow[]>(
    'SELECT * FROM players WHERE team_id = $1',
    [teamId],
  );
  team.roster = playerRows.map(mapRowToPlayer);

  // championPool 일괄 로딩
  const playerIds = team.roster.map(p => p.id);
  if (playerIds.length > 0) {
    const placeholders = playerIds.map((_, i) => `$${i + 1}`).join(', ');
    const profRows = await db.select<{
      player_id: string;
      champion_id: string;
      proficiency: number;
      games_played: number;
    }[]>(
      `SELECT player_id, champion_id, proficiency, games_played
       FROM champion_proficiency
       WHERE player_id IN (${placeholders})`,
      playerIds,
    );
    const poolMap = new Map<string, { championId: string; proficiency: number; gamesPlayed: number }[]>();
    for (const row of profRows) {
      const arr = poolMap.get(row.player_id) ?? [];
      arr.push({ championId: row.champion_id, proficiency: row.proficiency, gamesPlayed: row.games_played });
      poolMap.set(row.player_id, arr);
    }
    for (const player of team.roster) {
      player.championPool = poolMap.get(player.id) ?? [];
    }
  }

  return team;
}

// ─────────────────────────────────────────
// 선수 CRUD
// ─────────────────────────────────────────

export async function insertPlayer(player: {
  id: string;
  name: string;
  teamId: string | null;
  position: Position;
  age: number;
  nationality: string;
  mechanical: number;
  gameSense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
  mental: number;
  stamina: number;
  morale: number;
  salary: number;
  contractEndSeason: number;
  potential: number;
  peakAge: number;
  popularity: number;
  division: string;
  isUserPlayer?: boolean;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO players (
      id, name, team_id, position, age, nationality,
      mechanical, game_sense, teamwork, consistency, laning, aggression,
      mental, stamina, morale,
      salary, contract_end_season,
      potential, peak_age, popularity,
      division, is_user_player
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17,
      $18, $19, $20,
      $21, $22
    )`,
    [
      player.id,
      player.name,
      player.teamId,
      player.position,
      player.age,
      player.nationality,
      player.mechanical,
      player.gameSense,
      player.teamwork,
      player.consistency,
      player.laning,
      player.aggression,
      player.mental,
      player.stamina,
      player.morale,
      player.salary,
      player.contractEndSeason,
      player.potential,
      player.peakAge,
      player.popularity,
      player.division,
      player.isUserPlayer ? 1 : 0,
    ],
  );
}

export async function getPlayersByTeamId(
  teamId: string,
): Promise<(Player & { division: string })[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>(
    'SELECT * FROM players WHERE team_id = $1',
    [teamId],
  );
  const players = rows.map(mapRowToPlayer);

  // 챔피언 숙련도 일괄 로딩 (N+1 방지)
  if (players.length > 0) {
    const playerIds = players.map(p => p.id);
    const placeholders = playerIds.map((_, i) => `$${i + 1}`).join(',');
    const profRows = await db.select<{
      player_id: string;
      champion_id: string;
      proficiency: number;
      games_played: number;
    }[]>(
      `SELECT player_id, champion_id, proficiency, games_played
       FROM champion_proficiency
       WHERE player_id IN (${placeholders})`,
      playerIds,
    );

    // 선수별로 그룹핑
    const poolMap = new Map<string, ChampionProficiency[]>();
    for (const row of profRows) {
      const list = poolMap.get(row.player_id) ?? [];
      list.push({
        championId: row.champion_id,
        proficiency: row.proficiency,
        gamesPlayed: row.games_played,
      });
      poolMap.set(row.player_id, list);
    }

    for (const player of players) {
      player.championPool = poolMap.get(player.id) ?? [];
    }
  }

  return players;
}

/** 전체 선수를 한번에 조회 (팀별 그룹핑용) */
export async function getAllPlayersGroupedByTeam(): Promise<Map<string, (Player & { division: string })[]>> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE team_id IS NOT NULL');
  const players = rows.map(mapRowToPlayer);

  // 챔피언 숙련도 일괄 로딩
  const profRows = await db.select<{
    player_id: string;
    champion_id: string;
    proficiency: number;
    games_played: number;
  }[]>('SELECT player_id, champion_id, proficiency, games_played FROM champion_proficiency');

  const poolMap = new Map<string, ChampionProficiency[]>();
  for (const row of profRows) {
    const list = poolMap.get(row.player_id) ?? [];
    list.push({
      championId: row.champion_id,
      proficiency: row.proficiency,
      gamesPlayed: row.games_played,
    });
    poolMap.set(row.player_id, list);
  }

  const result = new Map<string, (Player & { division: string })[]>();
  for (const player of players) {
    player.championPool = poolMap.get(player.id) ?? [];
    const teamId = player.teamId ?? '';
    const list = result.get(teamId) ?? [];
    list.push(player);
    result.set(teamId, list);
  }

  return result;
}

export async function getPlayerById(id: string): Promise<(Player & { division: string }) | null> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return mapRowToPlayer(rows[0]);
}

// ─────────────────────────────────────────
// 시즌 CRUD
// ─────────────────────────────────────────

export async function createSeason(year: number, split: Split): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO seasons (year, split, current_week, is_active) VALUES ($1, $2, 1, TRUE)`,
    [year, split],
  );
  return result.lastInsertId;
}

export async function getActiveSeason(): Promise<Season | null> {
  const db = await getDatabase();
  const rows = await db.select<SeasonRow[]>(
    'SELECT * FROM seasons WHERE is_active = TRUE LIMIT 1',
  );
  if (rows.length === 0) return null;
  return mapRowToSeason(rows[0]);
}

// ─────────────────────────────────────────
// 세이브 CRUD
// ─────────────────────────────────────────

export async function createSave(
  mode: GameMode,
  teamId: string,
  playerId: string | null,
  seasonId: number,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO save_metadata (mode, user_team_id, user_player_id, current_season_id)
     VALUES ($1, $2, $3, $4)`,
    [mode, teamId, playerId, seasonId],
  );
  return result.lastInsertId;
}

export async function getSaveById(id: number): Promise<GameSave | null> {
  const db = await getDatabase();
  const rows = await db.select<SaveRow[]>(
    'SELECT * FROM save_metadata WHERE id = $1',
    [id],
  );
  if (rows.length === 0) return null;
  return mapRowToSave(rows[0]);
}

/** 세이브 타임스탬프(updated_at) 갱신 — 자동/수동 저장 시 호출 */
export async function updateSaveTimestamp(saveId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE save_metadata SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [saveId],
  );
}

// ─────────────────────────────────────────
// 챔피언 CRUD
// ─────────────────────────────────────────

interface ChampionRow {
  id: string;
  name: string;
  name_ko: string;
  primary_role: Position;
  secondary_roles: string;  // JSON string
  tier: Champion['tier'];
  tags: string;             // JSON string
  early_game: number;
  late_game: number;
  teamfight: number;
  split_push: number;
  difficulty: number;
}

export function mapRowToChampion(row: ChampionRow): Champion {
  return {
    id: row.id,
    name: row.name,
    nameKo: row.name_ko,
    primaryRole: row.primary_role,
    secondaryRoles: JSON.parse(row.secondary_roles) as Position[],
    tier: row.tier,
    tags: JSON.parse(row.tags),
    stats: {
      earlyGame: row.early_game,
      lateGame: row.late_game,
      teamfight: row.teamfight,
      splitPush: row.split_push,
      difficulty: row.difficulty,
    },
  };
}

export async function insertChampion(champ: Champion): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO champions (id, name, name_ko, primary_role, secondary_roles, tier, tags, early_game, late_game, teamfight, split_push, difficulty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      champ.id,
      champ.name,
      champ.nameKo,
      champ.primaryRole,
      JSON.stringify(champ.secondaryRoles),
      champ.tier,
      JSON.stringify(champ.tags),
      champ.stats.earlyGame,
      champ.stats.lateGame,
      champ.stats.teamfight,
      champ.stats.splitPush,
      champ.stats.difficulty,
    ],
  );
}

export async function getAllChampions(): Promise<Champion[]> {
  const db = await getDatabase();
  const rows = await db.select<ChampionRow[]>('SELECT * FROM champions');
  return rows.map(mapRowToChampion);
}

export async function getChampionById(id: string): Promise<Champion | null> {
  const db = await getDatabase();
  const rows = await db.select<ChampionRow[]>('SELECT * FROM champions WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  return mapRowToChampion(rows[0]);
}


// ─────────────────────────────────────────
// 매치 CRUD
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
  };
}

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
      GROUP BY tid
    ) w ON t.id = w.tid
    LEFT JOIN (
      SELECT
        CASE WHEN score_home < score_away THEN team_home_id ELSE team_away_id END as tid,
        COUNT(*) as losses,
        SUM(CASE WHEN score_home < score_away THEN score_home ELSE score_away END) as set_losses
      FROM matches WHERE season_id = $1 AND is_played = TRUE AND match_type = 'regular'
      GROUP BY tid
    ) l ON t.id = l.tid
    WHERE EXISTS (
      SELECT 1 FROM matches m WHERE m.season_id = $1
        AND (m.team_home_id = t.id OR m.team_away_id = t.id)
    )
    ORDER BY wins DESC, (COALESCE(w.set_wins, 0) - COALESCE(l.set_losses, 0)) DESC`,
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
// 일간 시스템 쿼리
// ─────────────────────────────────────────

/** 시즌 현재 날짜 업데이트 */
export async function updateSeasonDate(seasonId: number, date: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE seasons SET current_date = $1 WHERE id = $2',
    [date, seasonId],
  );
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

/** 선수 일일 컨디션 저장/업데이트 */
export async function upsertPlayerCondition(
  playerId: string,
  gameDate: string,
  stamina: number,
  morale: number,
  form: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO player_daily_condition (player_id, game_date, stamina, morale, form)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(player_id, game_date)
     DO UPDATE SET stamina = $3, morale = $4, form = $5`,
    [playerId, gameDate, stamina, morale, form],
  );
}

/** 선수 일일 컨디션 조회 */
export async function getPlayerCondition(
  playerId: string,
  gameDate: string,
): Promise<{ stamina: number; morale: number; form: number } | null> {
  const db = await getDatabase();
  const rows = await db.select<{ stamina: number; morale: number; form: number }[]>(
    'SELECT stamina, morale, form FROM player_daily_condition WHERE player_id = $1 AND game_date = $2',
    [playerId, gameDate],
  );
  return rows.length > 0 ? rows[0] : null;
}

/** 팀 전체 선수 컨디션 배치 조회 (N+1 방지) */
export async function getTeamConditions(
  teamId: string,
  gameDate: string,
): Promise<Map<string, { stamina: number; morale: number; form: number }>> {
  const db = await getDatabase();
  const rows = await db.select<{
    player_id: string;
    stamina: number;
    morale: number;
    form: number;
  }[]>(
    `SELECT pdc.player_id, pdc.stamina, pdc.morale, pdc.form
     FROM player_daily_condition pdc
     JOIN players p ON p.id = pdc.player_id
     WHERE p.team_id = $1 AND pdc.game_date = $2`,
    [teamId, gameDate],
  );

  const result = new Map<string, { stamina: number; morale: number; form: number }>();
  for (const row of rows) {
    result.set(row.player_id, {
      stamina: row.stamina,
      morale: row.morale,
      form: row.form,
    });
  }
  return result;
}

/** 배치 컨디션 upsert */
export async function batchUpsertPlayerConditions(
  records: { playerId: string; gameDate: string; stamina: number; morale: number; form: number }[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDatabase();
  for (const r of records) {
    await db.execute(
      `INSERT INTO player_daily_condition (player_id, game_date, stamina, morale, form)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(player_id, game_date)
       DO UPDATE SET stamina = $3, morale = $4, form = $5`,
      [r.playerId, r.gameDate, r.stamina, r.morale, r.form],
    );
  }
}

/** 일간 이벤트 기록 */
export async function insertDailyEvent(
  seasonId: number,
  gameDate: string,
  eventType: string,
  targetId?: string,
  description?: string,
  data?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO daily_events (season_id, game_date, event_type, target_id, description, data)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [seasonId, gameDate, eventType, targetId ?? null, description ?? null, data ?? null],
  );
}

/** 특정 날짜의 이벤트 조회 */
export async function getDailyEvents(
  seasonId: number,
  gameDate: string,
): Promise<{ eventType: string; targetId?: string; description?: string; data?: string }[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    event_type: string;
    target_id: string | null;
    description: string | null;
    data: string | null;
  }[]>(
    'SELECT event_type, target_id, description, data FROM daily_events WHERE season_id = $1 AND game_date = $2 ORDER BY id',
    [seasonId, gameDate],
  );
  return rows.map(r => ({
    eventType: r.event_type,
    targetId: r.target_id ?? undefined,
    description: r.description ?? undefined,
    data: r.data ?? undefined,
  }));
}

/** 최근 이벤트 목록 조회 (뉴스피드용, 날짜 역순) */
export async function getRecentDailyEvents(
  seasonId: number,
  limit: number = 20,
  offset: number = 0,
): Promise<{
  id: number;
  seasonId: number;
  gameDate: string;
  eventType: string;
  targetId: string | null;
  description: string;
}[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    id: number;
    season_id: number;
    game_date: string;
    event_type: string;
    target_id: string | null;
    description: string | null;
  }[]>(
    `SELECT id, season_id, game_date, event_type, target_id, description
     FROM daily_events
     WHERE season_id = $1
     ORDER BY game_date DESC, id DESC
     LIMIT $2 OFFSET $3`,
    [seasonId, limit, offset],
  );
  return rows.map(r => ({
    id: r.id,
    seasonId: r.season_id,
    gameDate: r.game_date,
    eventType: r.event_type,
    targetId: r.target_id,
    description: r.description ?? '',
  }));
}

// ─────────────────────────────────────────
// 선수 특성 (Traits)
// ─────────────────────────────────────────

/** 선수 특성 삽입 (시딩용) */
export async function insertPlayerTrait(playerId: string, traitId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'INSERT OR IGNORE INTO player_traits (player_id, trait_id) VALUES ($1, $2)',
    [playerId, traitId],
  );
}

/** 팀 전체 선수의 특성을 한번에 조회 (Record<playerId, traitId[]>) */
export async function getTraitsByTeamId(teamId: string): Promise<Record<string, string[]>> {
  const db = await getDatabase();
  const rows = await db.select<{ player_id: string; trait_id: string }[]>(
    `SELECT pt.player_id, pt.trait_id
     FROM player_traits pt
     JOIN players p ON p.id = pt.player_id
     WHERE p.team_id = $1`,
    [teamId],
  );

  const result: Record<string, string[]> = {};
  for (const row of rows) {
    if (!result[row.player_id]) result[row.player_id] = [];
    result[row.player_id].push(row.trait_id);
  }
  return result;
}

/** 팀 선수들의 폼 배치 조회 (경기 시뮬레이션용) */
export async function getFormByTeamId(
  teamId: string,
  gameDate: string,
): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.select<{ player_id: string; form: number }[]>(
    `SELECT pdc.player_id, pdc.form
     FROM player_daily_condition pdc
     JOIN players p ON p.id = pdc.player_id
     WHERE p.team_id = $1 AND pdc.game_date = $2`,
    [teamId, gameDate],
  );

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.player_id] = row.form;
  }
  return result;
}

// ─────────────────────────────────────────
// 선수 스탯 업데이트 (성장/하락)
// ─────────────────────────────────────────

/** 선수 핵심 스탯 업데이트 */
/** 선수 디비전(1군/2군) 변경 */
export async function updatePlayerDivision(
  playerId: string,
  division: 'main' | 'sub',
): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE players SET division = $1 WHERE id = $2', [division, playerId]);
}

export async function updatePlayerStats(
  playerId: string,
  stats: {
    mechanical: number;
    gameSense: number;
    teamwork: number;
    consistency: number;
    laning: number;
    aggression: number;
  },
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE players SET
       mechanical = $1, game_sense = $2, teamwork = $3,
       consistency = $4, laning = $5, aggression = $6
     WHERE id = $7`,
    [stats.mechanical, stats.gameSense, stats.teamwork,
     stats.consistency, stats.laning, stats.aggression, playerId],
  );
}

/** 선수 멘탈 스탯(mental, stamina, morale) 업데이트 */
export async function updatePlayerMental(
  playerId: string,
  mental: {
    mental: number;
    stamina: number;
    morale: number;
  },
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE players SET mental = $1, stamina = $2, morale = $3 WHERE id = $4`,
    [mental.mental, mental.stamina, mental.morale, playerId],
  );
}

/** 전체 선수 나이 1 증가 (시즌 종료 시) */
export async function incrementAllPlayerAges(): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE players SET age = age + 1');
}

/** 시즌 비활성화 */
export async function deactivateSeason(seasonId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE seasons SET is_active = FALSE WHERE id = $1', [seasonId]);
}

/** 모든 선수 조회 (성장 계산용) */
export async function getAllPlayers(): Promise<Player[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE team_id IS NOT NULL');
  return rows.map(r => mapRowToPlayer(r));
}

/** 선수의 시즌 평균 폼 조회 */
export async function getPlayerAverageForm(playerId: string): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ avg_form: number | null }[]>(
    'SELECT AVG(form) as avg_form FROM player_daily_condition WHERE player_id = $1',
    [playerId],
  );
  return rows[0]?.avg_form ?? 50;
}

// ─────────────────────────────────────────
// 재정 시스템 (Finance)
// ─────────────────────────────────────────

interface FinanceLogRow {
  id: number;
  team_id: string;
  season_id: number;
  game_date: string;
  type: string;
  category: string;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface FinanceLog {
  id: number;
  teamId: string;
  seasonId: number;
  gameDate: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  createdAt: string;
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  logs: FinanceLog[];
}

function mapRowToFinanceLog(row: FinanceLogRow): FinanceLog {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    gameDate: row.game_date,
    type: row.type as 'income' | 'expense',
    category: row.category,
    amount: row.amount,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

/** 재정 로그 삽입 */
export async function insertFinanceLog(
  teamId: string,
  seasonId: number,
  gameDate: string,
  type: 'income' | 'expense',
  category: string,
  amount: number,
  description?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO team_finance_log (team_id, season_id, game_date, type, category, amount, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [teamId, seasonId, gameDate, type, category, amount, description ?? null],
  );
}

/** 팀의 시즌 재정 요약 조회 */
export async function getTeamFinanceSummary(
  teamId: string,
  seasonId: number,
): Promise<FinanceSummary> {
  const db = await getDatabase();
  const rows = await db.select<FinanceLogRow[]>(
    `SELECT * FROM team_finance_log WHERE team_id = $1 AND season_id = $2 ORDER BY game_date DESC, id DESC`,
    [teamId, seasonId],
  );

  const logs = rows.map(mapRowToFinanceLog);
  let totalIncome = 0;
  let totalExpense = 0;

  for (const log of logs) {
    if (log.type === 'income') {
      totalIncome += log.amount;
    } else {
      totalExpense += log.amount;
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    logs,
  };
}

/** 모든 팀의 주급 처리 (월급/4 기준) */
export async function processWeeklySalaries(
  seasonId: number,
  gameDate: string,
): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<{ team_id: string; total_salary: number }[]>(
    `SELECT team_id, SUM(salary) as total_salary FROM players WHERE team_id IS NOT NULL GROUP BY team_id`,
  );

  for (const row of rows) {
    const weeklySalary = Math.round(row.total_salary / 4);
    if (weeklySalary <= 0) continue;

    await db.execute(
      `INSERT INTO team_finance_log (team_id, season_id, game_date, type, category, amount, description)
       VALUES ($1, $2, $3, 'expense', 'salary', $4, $5)`,
      [row.team_id, seasonId, gameDate, weeklySalary, '주급 지급'],
    );

    // 팀 budget 차감
    await db.execute(
      `UPDATE teams SET budget = budget - $1 WHERE id = $2`,
      [weeklySalary, row.team_id],
    );
  }
}

/** 팀 예산 업데이트 */
export async function updateTeamBudget(teamId: string, newBudget: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE teams SET budget = $1 WHERE id = $2',
    [newBudget, teamId],
  );
}

// ─────────────────────────────────────────
// 이적 시장 (Transfer Market)
// ─────────────────────────────────────────

export interface TransferOffer {
  id: number;
  seasonId: number;
  fromTeamId: string;
  toTeamId: string | null;
  playerId: string;
  transferFee: number;
  offeredSalary: number;
  contractYears: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  offerDate: string;
  resolvedDate?: string;
}

/** 이적 제안 생성 */
export async function createTransferOffer(offer: {
  seasonId: number;
  fromTeamId: string;
  toTeamId: string | null;
  playerId: string;
  transferFee: number;
  offeredSalary: number;
  contractYears: number;
  offerDate: string;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO transfer_offers (season_id, from_team_id, to_team_id, player_id, transfer_fee, offered_salary, contract_years, offer_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [offer.seasonId, offer.fromTeamId, offer.toTeamId, offer.playerId,
     offer.transferFee, offer.offeredSalary, offer.contractYears, offer.offerDate],
  );
  return result.lastInsertId;
}

/** 이적 제안 상태 변경 */
export async function updateTransferOfferStatus(
  offerId: number,
  status: 'accepted' | 'rejected' | 'cancelled',
  resolvedDate: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE transfer_offers SET status = $1, resolved_date = $2 WHERE id = $3',
    [status, resolvedDate, offerId],
  );
}

/** 특정 시즌의 이적 제안 조회 */
export async function getTransferOffers(
  seasonId: number,
  status?: string,
): Promise<TransferOffer[]> {
  const db = await getDatabase();
  const query = status
    ? 'SELECT * FROM transfer_offers WHERE season_id = $1 AND status = $2 ORDER BY offer_date DESC'
    : 'SELECT * FROM transfer_offers WHERE season_id = $1 ORDER BY offer_date DESC';
  const params = status ? [seasonId, status] : [seasonId];

  const rows = await db.select<{
    id: number; season_id: number; from_team_id: string; to_team_id: string | null;
    player_id: string; transfer_fee: number; offered_salary: number; contract_years: number;
    status: string; offer_date: string; resolved_date: string | null;
  }[]>(query, params);

  return rows.map(r => ({
    id: r.id,
    seasonId: r.season_id,
    fromTeamId: r.from_team_id,
    toTeamId: r.to_team_id,
    playerId: r.player_id,
    transferFee: r.transfer_fee,
    offeredSalary: r.offered_salary,
    contractYears: r.contract_years,
    status: r.status as TransferOffer['status'],
    offerDate: r.offer_date,
    resolvedDate: r.resolved_date ?? undefined,
  }));
}

/** 선수 소속팀 변경 */
export async function updatePlayerTeam(
  playerId: string,
  newTeamId: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE players SET team_id = $1 WHERE id = $2', [newTeamId, playerId]);
}

/** 선수 계약 업데이트 */
export async function updatePlayerContract(
  playerId: string,
  salary: number,
  contractEndSeason: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE players SET salary = $1, contract_end_season = $2 WHERE id = $3',
    [salary, contractEndSeason, playerId],
  );
}

/** 자유계약 선수 조회 (team_id IS NULL) */
export async function getFreeAgents(): Promise<(Player & { division: string })[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE team_id IS NULL');
  return rows.map(mapRowToPlayer);
}

/** 계약 만료 선수 조회 (특정 시즌에 만료되는 선수) */
export async function getExpiringContracts(endSeason: number): Promise<(Player & { division: string })[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>(
    'SELECT * FROM players WHERE contract_end_season <= $1 AND team_id IS NOT NULL',
    [endSeason],
  );
  return rows.map(mapRowToPlayer);
}

/** 팀 총 연봉 조회 */
export async function getTeamTotalSalary(teamId: string): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ total: number | null }[]>(
    'SELECT SUM(salary) as total FROM players WHERE team_id = $1',
    [teamId],
  );
  return rows[0]?.total ?? 0;
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
// 스폰서 (Sponsors)
// ─────────────────────────────────────────

interface SponsorRow {
  id: number;
  season_id: number;
  team_id: string;
  name: string;
  tier: string;
  weekly_payout: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export interface Sponsor {
  id: number;
  seasonId: number;
  teamId: string;
  name: string;
  tier: string;
  weeklyPayout: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
}

function mapRowToSponsor(row: SponsorRow): Sponsor {
  return {
    id: row.id,
    seasonId: row.season_id,
    teamId: row.team_id,
    name: row.name,
    tier: row.tier,
    weeklyPayout: row.weekly_payout,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as Sponsor['status'],
  };
}

/** 스폰서 계약 삽입 */
export async function insertSponsor(sponsor: {
  seasonId: number;
  teamId: string;
  name: string;
  tier: string;
  weeklyPayout: number;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO sponsors (season_id, team_id, name, tier, weekly_payout, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [sponsor.seasonId, sponsor.teamId, sponsor.name, sponsor.tier,
     sponsor.weeklyPayout, sponsor.startDate, sponsor.endDate],
  );
  return result.lastInsertId;
}

/** 팀의 활성 스폰서 조회 */
export async function getActiveSponsors(
  teamId: string,
  seasonId: number,
): Promise<Sponsor[]> {
  const db = await getDatabase();
  const rows = await db.select<SponsorRow[]>(
    `SELECT * FROM sponsors WHERE team_id = $1 AND season_id = $2 AND status = 'active' ORDER BY weekly_payout DESC`,
    [teamId, seasonId],
  );
  return rows.map(mapRowToSponsor);
}

/** 팀의 전체 스폰서 조회 (만료 포함) */
export async function getAllSponsors(
  teamId: string,
  seasonId: number,
): Promise<Sponsor[]> {
  const db = await getDatabase();
  const rows = await db.select<SponsorRow[]>(
    `SELECT * FROM sponsors WHERE team_id = $1 AND season_id = $2 ORDER BY status, weekly_payout DESC`,
    [teamId, seasonId],
  );
  return rows.map(mapRowToSponsor);
}

/** 스폰서 상태 변경 */
export async function updateSponsorStatus(
  sponsorId: number,
  status: 'active' | 'expired' | 'cancelled',
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE sponsors SET status = $1 WHERE id = $2',
    [status, sponsorId],
  );
}

// ─────────────────────────────────────────
// 선수 관계 (친밀도)
// ─────────────────────────────────────────

interface PlayerRelationRow {
  player_id: string;
  target_player_id: string;
  affinity: number;
  last_interaction_date: string | null;
}

export interface PlayerRelation {
  playerId: string;
  targetPlayerId: string;
  affinity: number;
  lastInteractionDate: string | null;
}

function mapRowToPlayerRelation(row: PlayerRelationRow): PlayerRelation {
  return {
    playerId: row.player_id,
    targetPlayerId: row.target_player_id,
    affinity: row.affinity,
    lastInteractionDate: row.last_interaction_date,
  };
}

/** 특정 선수의 모든 친밀도 조회 */
export async function getPlayerRelations(playerId: string): Promise<PlayerRelation[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRelationRow[]>(
    'SELECT * FROM player_relations WHERE player_id = $1',
    [playerId],
  );
  return rows.map(mapRowToPlayerRelation);
}

/** 친밀도 저장 (UPSERT) */
export async function upsertPlayerRelation(
  playerId: string,
  targetPlayerId: string,
  affinity: number,
  lastInteractionDate: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO player_relations (player_id, target_player_id, affinity, last_interaction_date)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (player_id, target_player_id) DO UPDATE SET
       affinity = $3,
       last_interaction_date = $4`,
    [playerId, targetPlayerId, affinity, lastInteractionDate],
  );
}

// ─────────────────────────────────────────
// 챔피언 패치 시스템 (Champion Patches)
// ─────────────────────────────────────────

/** 챔피언 패치 이력 삽입 */
export async function insertChampionPatch(patch: {
  seasonId: number;
  week: number;
  championId: string;
  statKey: string;
  oldValue: string;
  newValue: string;
  reason?: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO champion_patches (season_id, week, champion_id, stat_key, old_value, new_value, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [patch.seasonId, patch.week, patch.championId, patch.statKey, patch.oldValue, patch.newValue, patch.reason ?? null],
  );
}

/** 챔피언 스탯 모디파이어 타입 */
export interface ChampionStatModifier {
  earlyGameMod: number;
  lateGameMod: number;
  teamfightMod: number;
  splitPushMod: number;
}

/** 챔피언 스탯 모디파이어 UPSERT */
export async function upsertChampionStatModifier(mod: {
  championId: string;
  seasonId: number;
  earlyGameMod: number;
  lateGameMod: number;
  teamfightMod: number;
  splitPushMod: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO champion_stat_modifiers (champion_id, season_id, early_game_mod, late_game_mod, teamfight_mod, split_push_mod)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (champion_id, season_id) DO UPDATE SET
       early_game_mod = $3,
       late_game_mod = $4,
       teamfight_mod = $5,
       split_push_mod = $6`,
    [mod.championId, mod.seasonId, mod.earlyGameMod, mod.lateGameMod, mod.teamfightMod, mod.splitPushMod],
  );
}

/** 특정 챔피언의 시즌 스탯 모디파이어 조회 */
export async function getChampionStatModifier(
  championId: string,
  seasonId: number,
): Promise<ChampionStatModifier | null> {
  const db = await getDatabase();
  const rows = await db.select<{
    early_game_mod: number;
    late_game_mod: number;
    teamfight_mod: number;
    split_push_mod: number;
  }[]>(
    'SELECT early_game_mod, late_game_mod, teamfight_mod, split_push_mod FROM champion_stat_modifiers WHERE champion_id = $1 AND season_id = $2',
    [championId, seasonId],
  );
  if (rows.length === 0) return null;
  return {
    earlyGameMod: rows[0].early_game_mod,
    lateGameMod: rows[0].late_game_mod,
    teamfightMod: rows[0].teamfight_mod,
    splitPushMod: rows[0].split_push_mod,
  };
}



