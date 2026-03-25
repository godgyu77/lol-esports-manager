/**
 * 시즌 CRUD, 스탠딩, 일일 컨디션, 일일 이벤트
 */
import type { Season, Split } from '../../types';
import { getDatabase } from '../database';

// ─────────────────────────────────────────
// Row → TypeScript 매핑
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// 시즌 CRUD
// ─────────────────────────────────────────

export async function createSeason(year: number, split: Split): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO seasons (year, split, current_week, is_active) VALUES ($1, $2, 1, TRUE)`,
    [year, split],
  );
  if (!result.lastInsertId) throw new Error('시즌 생성 실패: lastInsertId 없음');
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

/** 시즌 비활성화 */
export async function deactivateSeason(seasonId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE seasons SET is_active = FALSE WHERE id = $1', [seasonId]);
}

/** 시즌 현재 날짜 업데이트 */
export async function updateSeasonDate(seasonId: number, date: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE seasons SET current_date = $1 WHERE id = $2',
    [date, seasonId],
  );
}

// ─────────────────────────────────────────
// 일일 컨디션
// ─────────────────────────────────────────

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

/** 배치 컨디션 upsert — 청크 단위 배치 INSERT */
export async function batchUpsertPlayerConditions(
  records: { playerId: string; gameDate: string; stamina: number; morale: number; form: number }[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDatabase();
  const CHUNK_SIZE = 50;
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map((_, idx) => {
      const b = idx * 5;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
    }).join(', ');
    const params = chunk.flatMap(r => [r.playerId, r.gameDate, r.stamina, r.morale, r.form]);
    await db.execute(
      `INSERT INTO player_daily_condition (player_id, game_date, stamina, morale, form)
       VALUES ${placeholders}
       ON CONFLICT(player_id, game_date)
       DO UPDATE SET stamina = excluded.stamina, morale = excluded.morale, form = excluded.form`,
      params,
    );
  }
}

// ─────────────────────────────────────────
// 일일 이벤트
// ─────────────────────────────────────────

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
