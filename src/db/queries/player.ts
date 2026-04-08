/**
 * 선수 CRUD, 관계, 폼, 케미스트리
 */
import type { Position } from '../../types';
import type { ChampionProficiency, Player, PlayerContract, PlayerMental, PlayerStats } from '../../types/player';
import { getDatabase } from '../database';

// ─────────────────────────────────────────
// Row → TypeScript 매핑
// ─────────────────────────────────────────

export interface PlayerRow {
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
  secondary_position: string | null;
}

export type PlayerWithDivision = Player & { division: string };

export function mapRowToPlayer(row: PlayerRow): PlayerWithDivision {
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
    secondaryPosition: (row.secondary_position as Position) ?? null,
    age: row.age,
    nationality: row.nationality,
    stats,
    mental,
    contract,
    traits: [],
    championPool: [],
    potential: row.potential,
    peakAge: row.peak_age,
    popularity: row.popularity,
    playstyle: 'versatile' as const,
    careerGames: 0,
    chemistry: {},
    formHistory: [],
    division: row.division,
  };
}

async function attachChampionPools(
  db: Awaited<ReturnType<typeof getDatabase>>,
  players: PlayerWithDivision[],
): Promise<void> {
  if (players.length === 0) return;

  const playerIds = players.map((player) => player.id);
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

async function attachTraits(
  db: Awaited<ReturnType<typeof getDatabase>>,
  players: PlayerWithDivision[],
): Promise<void> {
  if (players.length === 0) return;

  const playerIds = players.map((player) => player.id);
  const placeholders = playerIds.map((_, i) => `$${i + 1}`).join(',');
  const traitRows = await db.select<{ player_id: string; trait_id: string }[]>(
    `SELECT player_id, trait_id
     FROM player_traits
     WHERE player_id IN (${placeholders})`,
    playerIds,
  );

  const traitMap = new Map<string, string[]>();
  for (const row of traitRows) {
    const list = traitMap.get(row.player_id) ?? [];
    list.push(row.trait_id);
    traitMap.set(row.player_id, list);
  }

  for (const player of players) {
    player.traits = traitMap.get(player.id) ?? [];
  }
}

export async function hydratePlayers(
  db: Awaited<ReturnType<typeof getDatabase>>,
  players: PlayerWithDivision[],
): Promise<PlayerWithDivision[]> {
  await Promise.all([
    attachChampionPools(db, players),
    attachTraits(db, players),
  ]);
  return players;
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
  secondaryPosition?: Position | null;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO players (
      id, name, team_id, position, age, nationality,
      mechanical, game_sense, teamwork, consistency, laning, aggression,
      mental, stamina, morale,
      salary, contract_end_season,
      potential, peak_age, popularity,
      division, is_user_player, secondary_position
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15,
      $16, $17,
      $18, $19, $20,
      $21, $22, $23
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
      player.secondaryPosition ?? null,
    ],
  );
}

export async function getPlayersByTeamId(
  teamId: string,
): Promise<PlayerWithDivision[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>(
    'SELECT * FROM players WHERE team_id = $1',
    [teamId],
  );
  const players = await hydratePlayers(db, rows.map(mapRowToPlayer));

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
export async function getAllPlayersGroupedByTeam(): Promise<Map<string, PlayerWithDivision[]>> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE team_id IS NOT NULL');
  const players = rows.map(mapRowToPlayer);
  await attachTraits(db, players);

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

  const result = new Map<string, PlayerWithDivision[]>();
  for (const player of players) {
    player.championPool = poolMap.get(player.id) ?? [];
    const teamId = player.teamId ?? '';
    const list = result.get(teamId) ?? [];
    list.push(player);
    result.set(teamId, list);
  }

  return result;
}

export async function getPlayerById(id: string): Promise<PlayerWithDivision | null> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE id = $1', [id]);
  if (rows.length === 0) return null;
  const player = mapRowToPlayer(rows[0]);
  await hydratePlayers(db, [player]);
  return player;
}

/** 모든 선수 조회 (성장 계산용) */
export async function getAllPlayers(): Promise<Player[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE team_id IS NOT NULL');
  return hydratePlayers(db, rows.map(r => mapRowToPlayer(r)));
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

/** 자유계약 선수 조회 (team_id IS NULL) */
export async function getFreeAgents(): Promise<PlayerWithDivision[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>('SELECT * FROM players WHERE team_id IS NULL');
  return hydratePlayers(db, rows.map(mapRowToPlayer));
}

/** 계약 만료 선수 조회 (특정 시즌에 만료되는 선수) */
export async function getExpiringContracts(endSeason: number): Promise<PlayerWithDivision[]> {
  const db = await getDatabase();
  const rows = await db.select<PlayerRow[]>(
    'SELECT * FROM players WHERE contract_end_season <= $1 AND team_id IS NOT NULL',
    [endSeason],
  );
  return hydratePlayers(db, rows.map(mapRowToPlayer));
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

// ═════════════════════════════════════════
// player_career_stats CRUD
// ═════════════════════════════════════════

export interface PlayerCareerStats {
  playerId: string;
  teamId: string | null;
  totalGames: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalCs: number;
  totalDamage: number;
}

export async function getPlayerCareerStats(playerId: string): Promise<PlayerCareerStats | null> {
  const db = await getDatabase();
  const rows = await db.select<{
    player_id: string; team_id: string | null;
    total_games: number; total_kills: number; total_deaths: number;
    total_assists: number; total_cs: number; total_damage: number;
  }[]>(
    'SELECT * FROM player_career_stats WHERE player_id = $1',
    [playerId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    playerId: r.player_id,
    teamId: r.team_id,
    totalGames: r.total_games,
    totalKills: r.total_kills,
    totalDeaths: r.total_deaths,
    totalAssists: r.total_assists,
    totalCs: r.total_cs,
    totalDamage: r.total_damage,
  };
}

export async function upsertPlayerCareerStats(
  playerId: string,
  teamId: string | null,
  gameStats: { kills: number; deaths: number; assists: number; cs: number; damage: number },
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO player_career_stats (player_id, team_id, total_games, total_kills, total_deaths, total_assists, total_cs, total_damage)
     VALUES ($1, $2, 1, $3, $4, $5, $6, $7)
     ON CONFLICT(player_id) DO UPDATE SET
       team_id = $2,
       total_games = total_games + 1,
       total_kills = total_kills + $3,
       total_deaths = total_deaths + $4,
       total_assists = total_assists + $5,
       total_cs = total_cs + $6,
       total_damage = total_damage + $7`,
    [playerId, teamId, gameStats.kills, gameStats.deaths, gameStats.assists, gameStats.cs, gameStats.damage],
  );
}

// ═════════════════════════════════════════
// player_form_history CRUD
// ═════════════════════════════════════════

export interface PlayerFormEntry {
  id: number;
  playerId: string;
  gameDate: string;
  formScore: number;
}

export async function insertPlayerFormHistory(
  playerId: string,
  gameDate: string,
  formScore: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'INSERT INTO player_form_history (player_id, game_date, form_score) VALUES ($1, $2, $3)',
    [playerId, gameDate, formScore],
  );

  // 최근 10개만 유지 (롤링)
  await db.execute(
    `DELETE FROM player_form_history WHERE player_id = $1 AND id NOT IN (
       SELECT id FROM player_form_history WHERE player_id = $1 ORDER BY id DESC LIMIT 10
     )`,
    [playerId],
  );
}

export async function getPlayerFormHistory(playerId: string): Promise<PlayerFormEntry[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    id: number; player_id: string; game_date: string; form_score: number;
  }[]>(
    'SELECT * FROM player_form_history WHERE player_id = $1 ORDER BY game_date DESC, id DESC LIMIT 10',
    [playerId],
  );
  return rows.map(r => ({
    id: r.id,
    playerId: r.player_id,
    gameDate: r.game_date,
    formScore: r.form_score,
  }));
}

// ═════════════════════════════════════════
// player_chemistry CRUD
// ═════════════════════════════════════════

export interface PlayerChemistryRow {
  playerAId: string;
  playerBId: string;
  chemistryScore: number;
}

export interface PlayerChemistryLink {
  playerId: string;
  otherPlayerId: string;
  chemistryScore: number;
}

export async function upsertPlayerChemistry(
  playerAId: string,
  playerBId: string,
  score: number,
): Promise<void> {
  const db = await getDatabase();
  // ID 순서 정규화 (항상 작은 ID가 A)
  const [a, b] = playerAId < playerBId ? [playerAId, playerBId] : [playerBId, playerAId];
  const clamped = Math.max(0, Math.min(100, score));
  await db.execute(
    `INSERT INTO player_chemistry (player_a_id, player_b_id, chemistry_score)
     VALUES ($1, $2, $3)
     ON CONFLICT(player_a_id, player_b_id) DO UPDATE SET chemistry_score = $3`,
    [a, b, clamped],
  );
}

export async function adjustPlayerChemistry(
  playerAId: string,
  playerBId: string,
  delta: number,
): Promise<void> {
  const db = await getDatabase();
  const [a, b] = playerAId < playerBId ? [playerAId, playerBId] : [playerBId, playerAId];
  await db.execute(
    `INSERT INTO player_chemistry (player_a_id, player_b_id, chemistry_score)
     VALUES ($1, $2, $3)
     ON CONFLICT(player_a_id, player_b_id) DO UPDATE SET
       chemistry_score = MAX(0, MIN(100, chemistry_score + $4))`,
    [a, b, 50 + delta, delta],
  );
}

export async function getTeamChemistryPairs(teamId: string): Promise<PlayerChemistryRow[]> {
  const db = await getDatabase();
  const players = await getPlayersByTeamId(teamId);
  const ids = players.map(p => p.id);
  if (ids.length < 2) return [];

  const phA = ids.map((_, i) => `$${i + 1}`).join(', ');
  const phB = ids.map((_, i) => `$${i + 1 + ids.length}`).join(', ');
  const rows = await db.select<{
    player_a_id: string; player_b_id: string; chemistry_score: number;
  }[]>(
    `SELECT * FROM player_chemistry
     WHERE player_a_id IN (${phA}) AND player_b_id IN (${phB})`,
    [...ids, ...ids],
  );
  return rows.map(r => ({
    playerAId: r.player_a_id,
    playerBId: r.player_b_id,
    chemistryScore: r.chemistry_score,
  }));
}

export async function getPlayerChemistryLinks(playerId: string): Promise<PlayerChemistryLink[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    player_a_id: string; player_b_id: string; chemistry_score: number;
  }[]>(
    `SELECT player_a_id, player_b_id, chemistry_score
     FROM player_chemistry
     WHERE player_a_id = $1 OR player_b_id = $1`,
    [playerId],
  );

  return rows.map((row) => ({
    playerId,
    otherPlayerId: row.player_a_id === playerId ? row.player_b_id : row.player_a_id,
    chemistryScore: row.chemistry_score,
  }));
}
