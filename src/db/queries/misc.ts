import type { GameMode, GameSave, Position } from '../../types';
import type { Champion, ChampionTag } from '../../types/champion';
import { getDatabase, getGameDatabaseFileName, getMetaDatabase } from '../database';

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

interface ChampionRow {
  id: string;
  name: string;
  name_ko: string;
  primary_role: Position;
  secondary_roles: string;
  tier: Champion['tier'];
  tags: string;
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
    secondaryRoles: safeJsonParse<Position[]>(row.secondary_roles, []),
    tier: row.tier,
    tags: safeJsonParse<ChampionTag[]>(row.tags, []),
    stats: {
      earlyGame: row.early_game,
      lateGame: row.late_game,
      teamfight: row.teamfight,
      splitPush: row.split_push,
      difficulty: row.difficulty,
    },
    primaryBuild: 'bruiser_ad',
    secondaryBuild: null,
    damageProfile: 'physical',
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

export interface ChampionStatModifier {
  earlyGameMod: number;
  lateGameMod: number;
  teamfightMod: number;
  splitPushMod: number;
}

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

interface SaveRow {
  id: number;
  game_save_id: number;
  mode: GameMode;
  user_team_id: string;
  user_player_id: string | null;
  current_season_id: number;
  db_filename: string;
  created_at: string;
  updated_at: string;
  slot_number: number;
  save_name: string;
  play_time_minutes: number;
  team_name: string | null;
  season_info: string | null;
  rng_seed: string | null;
}

export function mapRowToSave(row: SaveRow): GameSave {
  return {
    id: row.game_save_id,
    metadataId: row.id,
    mode: row.mode,
    userTeamId: row.user_team_id,
    userPlayerId: row.user_player_id ?? undefined,
    currentSeasonId: row.current_season_id,
    dbFilename: row.db_filename,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slotNumber: row.slot_number,
    saveName: row.save_name,
    playTimeMinutes: row.play_time_minutes,
    teamName: row.team_name ?? undefined,
    seasonInfo: row.season_info ?? undefined,
    rngSeed: row.rng_seed ?? undefined,
  };
}

export async function createSave(params: {
  mode: GameMode;
  teamId: string;
  playerId: string | null;
  seasonId: number;
  slotNumber: number;
  saveName: string;
  teamName?: string | null;
  seasonInfo?: string | null;
  rngSeed?: string | null;
  dbFilename?: string;
  gameSaveId?: number;
}): Promise<number> {
  const db = await getMetaDatabase();
  const dbFilename = params.dbFilename ?? getGameDatabaseFileName(params.slotNumber);

  await db.execute('DELETE FROM save_metadata WHERE slot_number = $1', [params.slotNumber]);
  const result = await db.execute(
    `INSERT INTO save_metadata (
       mode, user_team_id, user_player_id, current_season_id, db_filename,
       game_save_id, slot_number, save_name, team_name, season_info, rng_seed
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      params.mode,
      params.teamId,
      params.playerId,
      params.seasonId,
      dbFilename,
      params.gameSaveId ?? 1,
      params.slotNumber,
      params.saveName,
      params.teamName ?? null,
      params.seasonInfo ?? null,
      params.rngSeed ?? null,
    ],
  );

  if (!result.lastInsertId) {
    throw new Error('Failed to create save metadata: missing lastInsertId');
  }

  return result.lastInsertId;
}

export async function getSaveById(id: number): Promise<GameSave | null> {
  const db = await getMetaDatabase();
  const rows = await db.select<SaveRow[]>(
    'SELECT * FROM save_metadata WHERE id = $1',
    [id],
  );
  if (rows.length === 0) return null;
  return mapRowToSave(rows[0]);
}

export async function getSaveBySlotNumber(slotNumber: number): Promise<GameSave | null> {
  const db = await getMetaDatabase();
  const rows = await db.select<SaveRow[]>(
    'SELECT * FROM save_metadata WHERE slot_number = $1 LIMIT 1',
    [slotNumber],
  );
  if (rows.length === 0) return null;
  return mapRowToSave(rows[0]);
}

export async function updateSaveTimestamp(saveId: number): Promise<void> {
  const db = await getMetaDatabase();
  await db.execute(
    'UPDATE save_metadata SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [saveId],
  );
}

export async function createManualSave(params: {
  mode: GameMode;
  teamId: string;
  playerId: string | null;
  seasonId: number;
  slotNumber: number;
  saveName: string;
  teamName: string | null;
  seasonInfo: string | null;
  rngSeed: string | null;
  dbFilename?: string;
  playTimeMinutes?: number;
  gameSaveId?: number;
}): Promise<number> {
  const db = await getMetaDatabase();
  const dbFilename = params.dbFilename ?? getGameDatabaseFileName(params.slotNumber);

  await db.execute('DELETE FROM save_metadata WHERE slot_number = $1', [params.slotNumber]);
  const result = await db.execute(
    `INSERT INTO save_metadata (
       mode, user_team_id, user_player_id, current_season_id, db_filename,
       game_save_id, slot_number, save_name, team_name, season_info, rng_seed, play_time_minutes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      params.mode,
      params.teamId,
      params.playerId,
      params.seasonId,
      dbFilename,
      params.gameSaveId ?? 1,
      params.slotNumber,
      params.saveName,
      params.teamName,
      params.seasonInfo,
      params.rngSeed,
      params.playTimeMinutes ?? 0,
    ],
  );
  if (!result.lastInsertId) {
    throw new Error('Failed to create manual save metadata: missing lastInsertId');
  }
  return result.lastInsertId;
}

export async function getAllSaves(): Promise<GameSave[]> {
  const db = await getMetaDatabase();
  const rows = await db.select<SaveRow[]>(
    'SELECT * FROM save_metadata ORDER BY slot_number ASC',
  );
  return rows.map(mapRowToSave);
}

export async function getAutoSave(): Promise<GameSave | null> {
  return getSaveBySlotNumber(0);
}

export async function deleteSave(saveId: number): Promise<void> {
  const db = await getMetaDatabase();
  await db.execute('DELETE FROM save_metadata WHERE id = $1', [saveId]);
}

export async function updateSaveMeta(
  saveId: number,
  updates: {
    saveName?: string;
    teamName?: string | null;
    seasonInfo?: string | null;
    playTimeMinutes?: number;
    dbFilename?: string;
  },
): Promise<void> {
  const db = await getMetaDatabase();
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (updates.saveName !== undefined) {
    setClauses.push(`save_name = $${idx++}`);
    params.push(updates.saveName);
  }
  if (updates.teamName !== undefined) {
    setClauses.push(`team_name = $${idx++}`);
    params.push(updates.teamName);
  }
  if (updates.seasonInfo !== undefined) {
    setClauses.push(`season_info = $${idx++}`);
    params.push(updates.seasonInfo);
  }
  if (updates.playTimeMinutes !== undefined) {
    setClauses.push(`play_time_minutes = $${idx++}`);
    params.push(updates.playTimeMinutes);
  }
  if (updates.dbFilename !== undefined) {
    setClauses.push(`db_filename = $${idx++}`);
    params.push(updates.dbFilename);
  }

  if (setClauses.length === 0) return;

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  params.push(saveId);

  await db.execute(
    `UPDATE save_metadata SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    params,
  );
}

export async function updateRngSeed(saveId: number, rngSeed: string): Promise<void> {
  const db = await getMetaDatabase();
  await db.execute(
    'UPDATE save_metadata SET rng_seed = $1 WHERE id = $2',
    [rngSeed, saveId],
  );
}

export async function updatePlayTime(saveId: number, minutes: number): Promise<void> {
  const db = await getMetaDatabase();
  await db.execute(
    'UPDATE save_metadata SET play_time_minutes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [minutes, saveId],
  );
}

export interface PatchMetaModifiersRow {
  seasonId: number;
  patchNumber: number;
  teamfightEfficiency: number;
  splitPushEfficiency: number;
  earlyAggroEfficiency: number;
  objectiveEfficiency: number;
}

export async function upsertPatchMetaModifiers(params: {
  seasonId: number;
  patchNumber: number;
  teamfightEfficiency: number;
  splitPushEfficiency: number;
  earlyAggroEfficiency: number;
  objectiveEfficiency: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT OR REPLACE INTO patch_meta_modifiers
     (season_id, patch_number, teamfight_efficiency, split_push_efficiency, early_aggro_efficiency, objective_efficiency)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.seasonId, params.patchNumber, params.teamfightEfficiency, params.splitPushEfficiency, params.earlyAggroEfficiency, params.objectiveEfficiency],
  );
}

export async function getLatestPatchMetaModifiers(): Promise<PatchMetaModifiersRow | null> {
  const db = await getDatabase();
  const rows = await db.select<{
    season_id: number;
    patch_number: number;
    teamfight_efficiency: number;
    split_push_efficiency: number;
    early_aggro_efficiency: number;
    objective_efficiency: number;
  }[]>(
    'SELECT * FROM patch_meta_modifiers ORDER BY season_id DESC, patch_number DESC LIMIT 1',
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    seasonId: row.season_id,
    patchNumber: row.patch_number,
    teamfightEfficiency: row.teamfight_efficiency,
    splitPushEfficiency: row.split_push_efficiency,
    earlyAggroEfficiency: row.early_aggro_efficiency,
    objectiveEfficiency: row.objective_efficiency,
  };
}
