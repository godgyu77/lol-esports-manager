/**
 * 팀 CRUD, 로스터, 플레이스타일
 */
import type { Region } from '../../types';
import type { PlayStyle, Team } from '../../types/team';
import { getDatabase } from '../database';
import { hydratePlayers, type PlayerRow, mapRowToPlayer } from './player';

// ─────────────────────────────────────────
// Row → TypeScript 매핑
// ─────────────────────────────────────────

interface TeamRow {
  id: string;
  name: string;
  short_name: string;
  region: Region;
  budget: number;
  salary_cap: number;
  reputation: number;
  play_style: string;
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
    playStyle: (row.play_style as Team['playStyle']) ?? 'controlled',
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
  team.roster = await hydratePlayers(db, playerRows.map(mapRowToPlayer));

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
// 팀 전술
// ─────────────────────────────────────────

/** 팀 전술 조회 */
export async function getTeamPlayStyle(
  teamId: string,
): Promise<PlayStyle> {
  const db = await getDatabase();
  const rows = await db.select<{ play_style: string }[]>(
    'SELECT play_style FROM teams WHERE id = $1',
    [teamId],
  );
  return (rows[0]?.play_style as PlayStyle) ?? 'controlled';
}

export async function updateTeamPlayStyle(
  teamId: string,
  style: PlayStyle,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE teams SET play_style = $1 WHERE id = $2',
    [style, teamId],
  );
}

// ─────────────────────────────────────────
// 팀 승률 조회
// ─────────────────────────────────────────

export async function getTeamRecentWinRate(
  teamId: string,
  seasonId: number,
): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<{ wins: number; total: number }[]>(
    `SELECT
       COALESCE(SUM(CASE WHEN score_home > score_away AND team_home_id = $1 THEN 1
                         WHEN score_away > score_home AND team_away_id = $1 THEN 1
                         ELSE 0 END), 0) as wins,
       COUNT(*) as total
     FROM matches
     WHERE season_id = $2 AND is_played = 1
       AND (team_home_id = $1 OR team_away_id = $1)`,
    [teamId, seasonId],
  );
  if (rows.length === 0 || rows[0].total === 0) return 0.5;
  return Math.round((rows[0].wins / rows[0].total) * 100) / 100;
}
