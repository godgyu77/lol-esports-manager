/**
 * 챔피언, 패치, 세이브, 패치 메타
 */
import type { GameMode, GameSave, Position } from '../../types';
import type { Champion, ChampionTag } from '../../types/champion';
import { getDatabase } from '../database';

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
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

// ─────────────────────────────────────────
// 챔피언 패치 시스템
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

// ─────────────────────────────────────────
// 세이브 CRUD
// ─────────────────────────────────────────

interface SaveRow {
  id: number;
  mode: GameMode;
  user_team_id: string;
  user_player_id: string | null;
  current_season_id: number;
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
    id: row.id,
    mode: row.mode,
    userTeamId: row.user_team_id,
    userPlayerId: row.user_player_id ?? undefined,
    currentSeasonId: row.current_season_id,
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

export async function createSave(
  mode: GameMode,
  teamId: string,
  playerId: string | null,
  seasonId: number,
  rngSeed?: string,
): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO save_metadata (mode, user_team_id, user_player_id, current_season_id, rng_seed)
     VALUES ($1, $2, $3, $4, $5)`,
    [mode, teamId, playerId, seasonId, rngSeed ?? null],
  );
  if (!result.lastInsertId) throw new Error('세이브 생성 실패: lastInsertId 없음');
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

/** 수동 저장 생성 (슬롯 지정) */
export async function createManualSave(
  mode: GameMode,
  teamId: string,
  playerId: string | null,
  seasonId: number,
  slotNumber: number,
  saveName: string,
  teamName: string | null,
  seasonInfo: string | null,
  rngSeed: string | null,
): Promise<number> {
  const db = await getDatabase();
  // 같은 슬롯에 기존 저장이 있으면 삭제
  await db.execute(
    'DELETE FROM save_metadata WHERE slot_number = $1',
    [slotNumber],
  );
  const result = await db.execute(
    `INSERT INTO save_metadata (mode, user_team_id, user_player_id, current_season_id, slot_number, save_name, team_name, season_info, rng_seed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [mode, teamId, playerId, seasonId, slotNumber, saveName, teamName, seasonInfo, rngSeed],
  );
  if (!result.lastInsertId) throw new Error('수동 세이브 생성 실패: lastInsertId 없음');
  return result.lastInsertId;
}

/** 모든 저장 슬롯 조회 */
export async function getAllSaves(): Promise<GameSave[]> {
  const db = await getDatabase();
  const rows = await db.select<SaveRow[]>(
    'SELECT * FROM save_metadata ORDER BY slot_number ASC',
  );
  return rows.map(mapRowToSave);
}

/** 자동 저장(슬롯 0) 조회 */
export async function getAutoSave(): Promise<GameSave | null> {
  const db = await getDatabase();
  const rows = await db.select<SaveRow[]>(
    'SELECT * FROM save_metadata WHERE slot_number = 0 LIMIT 1',
  );
  if (rows.length === 0) return null;
  return mapRowToSave(rows[0]);
}

/** 저장 삭제 */
export async function deleteSave(saveId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM save_metadata WHERE id = $1', [saveId]);
}

/** 저장 메타 업데이트 (팀 이름, 시즌 정보 등) */
export async function updateSaveMeta(
  saveId: number,
  updates: { saveName?: string; teamName?: string; seasonInfo?: string; playTimeMinutes?: number },
): Promise<void> {
  const db = await getDatabase();
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

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(saveId);

  await db.execute(
    `UPDATE save_metadata SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    params,
  );
}

/** RNG 시드 업데이트 */
export async function updateRngSeed(saveId: number, rngSeed: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE save_metadata SET rng_seed = $1 WHERE id = $2',
    [rngSeed, saveId],
  );
}

/** 플레이 시간 업데이트 */
export async function updatePlayTime(saveId: number, minutes: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE save_metadata SET play_time_minutes = $1 WHERE id = $2',
    [minutes, saveId],
  );
}

// ═════════════════════════════════════════
// patch_meta_modifiers CRUD
// ═════════════════════════════════════════

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
    season_id: number; patch_number: number;
    teamfight_efficiency: number; split_push_efficiency: number;
    early_aggro_efficiency: number; objective_efficiency: number;
  }[]>(
    'SELECT * FROM patch_meta_modifiers ORDER BY season_id DESC, patch_number DESC LIMIT 1',
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    seasonId: r.season_id,
    patchNumber: r.patch_number,
    teamfightEfficiency: r.teamfight_efficiency,
    splitPushEfficiency: r.split_push_efficiency,
    earlyAggroEfficiency: r.early_aggro_efficiency,
    objectiveEfficiency: r.objective_efficiency,
  };
}
