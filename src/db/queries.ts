/**
 * DB CRUD 함수 — @tauri-apps/plugin-sql 기반
 * snake_case DB row ↔ camelCase TypeScript 객체 매핑 포함
 */
import type { GameMode, GameSave, Position, Region, Season, Split } from '../types';
import type { Player, PlayerContract, PlayerMental, PlayerStats } from '../types/player';
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
  return rows.map(mapRowToPlayer);
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
