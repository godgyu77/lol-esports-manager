/**
 * 선수 특성, 폼, 스탯 업데이트, 솔로랭크
 */
import { getDatabase } from '../database';

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

// ═════════════════════════════════════════
// solo_rank_daily_log CRUD
// ═════════════════════════════════════════

export interface SoloRankDailyLog {
  id: number;
  playerId: string;
  gameDate: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lpChange: number;
  tierChanged: boolean;
  newTier: string | null;
  practiceChampionId: string | null;
  proficiencyGain: number;
}

export async function insertSoloRankDailyLog(params: {
  playerId: string;
  gameDate: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lpChange: number;
  tierChanged: boolean;
  newTier?: string;
  practiceChampionId?: string;
  proficiencyGain?: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO solo_rank_daily_log
     (player_id, game_date, games_played, wins, losses, lp_change, tier_changed, new_tier, practice_champion_id, proficiency_gain)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT(player_id, game_date) DO UPDATE SET
       games_played = $3, wins = $4, losses = $5, lp_change = $6,
       tier_changed = $7, new_tier = $8, practice_champion_id = $9, proficiency_gain = $10`,
    [
      params.playerId, params.gameDate, params.gamesPlayed, params.wins, params.losses,
      params.lpChange, params.tierChanged ? 1 : 0, params.newTier ?? null,
      params.practiceChampionId ?? null, params.proficiencyGain ?? 0,
    ],
  );
}

export async function getSoloRankDailyLogs(
  playerId: string,
  limit = 30,
): Promise<SoloRankDailyLog[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    id: number; player_id: string; game_date: string;
    games_played: number; wins: number; losses: number;
    lp_change: number; tier_changed: number; new_tier: string | null;
    practice_champion_id: string | null; proficiency_gain: number;
  }[]>(
    'SELECT * FROM solo_rank_daily_log WHERE player_id = $1 ORDER BY game_date DESC LIMIT $2',
    [playerId, limit],
  );
  return rows.map(r => ({
    id: r.id,
    playerId: r.player_id,
    gameDate: r.game_date,
    gamesPlayed: r.games_played,
    wins: r.wins,
    losses: r.losses,
    lpChange: r.lp_change,
    tierChanged: r.tier_changed === 1,
    newTier: r.new_tier,
    practiceChampionId: r.practice_champion_id,
    proficiencyGain: r.proficiency_gain,
  }));
}
