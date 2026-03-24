/**
 * 역대 기록/업적 엔진
 * - 시즌 기록 저장/조회
 * - 명예의 전당 관리
 * - 역대 기록 집계
 * - 선수 커리어 통산 기록
 */

import type { HallOfFameEntry, RecordType, SeasonRecord } from '../../types/records';
import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface HallOfFameRow {
  id: number;
  season_id: number;
  record_type: string;
  player_id: string | null;
  team_id: string | null;
  value: number | null;
  description: string | null;
  recorded_date: string;
}

interface SeasonRecordRow {
  id: number;
  season_id: number;
  team_id: string;
  final_standing: number | null;
  wins: number;
  losses: number;
  playoff_result: string | null;
  champion: number;
}

interface CareerStatsRow {
  player_id: string;
  player_name: string;
  team_id: string;
  position: string;
  seasons_played: number;
  total_games: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  total_cs: number;
  total_damage: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
}

interface AllTimeRecordRow {
  player_id: string;
  player_name: string;
  team_id: string;
  value: number;
}

// ─────────────────────────────────────────
// Row → TypeScript 매핑
// ─────────────────────────────────────────

function mapHallOfFameRow(row: HallOfFameRow): HallOfFameEntry {
  return {
    id: row.id,
    seasonId: row.season_id,
    recordType: row.record_type as RecordType,
    playerId: row.player_id,
    teamId: row.team_id,
    value: row.value,
    description: row.description,
    recordedDate: row.recorded_date,
  };
}

function mapSeasonRecordRow(row: SeasonRecordRow): SeasonRecord {
  return {
    id: row.id,
    seasonId: row.season_id,
    teamId: row.team_id,
    finalStanding: row.final_standing,
    wins: row.wins,
    losses: row.losses,
    playoffResult: row.playoff_result,
    champion: Boolean(row.champion),
  };
}

// ─────────────────────────────────────────
// 시즌 기록 저장
// ─────────────────────────────────────────

/**
 * 시즌 기록 저장
 */
export async function saveSeasonRecord(
  seasonId: number,
  teamId: string,
  standing: number | null,
  wins: number,
  losses: number,
  playoffResult: string | null,
  isChampion: boolean,
): Promise<SeasonRecord> {
  const db = await getDatabase();

  const result = await db.execute(
    `INSERT INTO season_records (season_id, team_id, final_standing, wins, losses, playoff_result, champion)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [seasonId, teamId, standing, wins, losses, playoffResult, isChampion ? 1 : 0],
  );

  return {
    id: result.lastInsertId as number,
    seasonId,
    teamId,
    finalStanding: standing,
    wins,
    losses,
    playoffResult,
    champion: isChampion,
  };
}

// ─────────────────────────────────────────
// 명예의 전당
// ─────────────────────────────────────────

/**
 * 명예의 전당 항목 추가
 */
export async function addHallOfFameEntry(
  seasonId: number,
  type: RecordType,
  playerId: string | null,
  teamId: string | null,
  value: number | null,
  description: string | null,
  date: string,
): Promise<HallOfFameEntry> {
  const db = await getDatabase();

  const result = await db.execute(
    `INSERT INTO hall_of_fame (season_id, record_type, player_id, team_id, value, description, recorded_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [seasonId, type, playerId, teamId, value, description, date],
  );

  return {
    id: result.lastInsertId as number,
    seasonId,
    recordType: type,
    playerId,
    teamId,
    value,
    description,
    recordedDate: date,
  };
}

/**
 * 전체 명예의 전당 조회
 */
export async function getHallOfFame(): Promise<HallOfFameEntry[]> {
  const db = await getDatabase();

  const rows = await db.select<HallOfFameRow[]>(
    `SELECT id, season_id, record_type, player_id, team_id, value, description, recorded_date
     FROM hall_of_fame
     ORDER BY season_id DESC,
       CASE record_type
         WHEN 'champion' THEN 1
         WHEN 'mvp' THEN 2
         WHEN 'all_pro' THEN 3
         WHEN 'most_kills' THEN 4
         WHEN 'most_wins' THEN 5
         WHEN 'longest_streak' THEN 6
       END`,
  );

  return rows.map(mapHallOfFameRow);
}

// ─────────────────────────────────────────
// 시즌별 기록 조회
// ─────────────────────────────────────────

/**
 * 특정 시즌의 팀별 기록 조회
 */
export async function getSeasonRecords(seasonId: number): Promise<SeasonRecord[]> {
  const db = await getDatabase();

  const rows = await db.select<SeasonRecordRow[]>(
    `SELECT id, season_id, team_id, final_standing, wins, losses, playoff_result, champion
     FROM season_records
     WHERE season_id = $1
     ORDER BY final_standing ASC NULLS LAST, wins DESC`,
    [seasonId],
  );

  return rows.map(mapSeasonRecordRow);
}

// ─────────────────────────────────────────
// 팀 역대 기록
// ─────────────────────────────────────────

/**
 * 특정 팀의 역대 시즌 기록 조회
 */
export async function getTeamHistory(teamId: string): Promise<SeasonRecord[]> {
  const db = await getDatabase();

  const rows = await db.select<SeasonRecordRow[]>(
    `SELECT id, season_id, team_id, final_standing, wins, losses, playoff_result, champion
     FROM season_records
     WHERE team_id = $1
     ORDER BY season_id DESC`,
    [teamId],
  );

  return rows.map(mapSeasonRecordRow);
}

// ─────────────────────────────────────────
// 선수 커리어 통산 기록
// ─────────────────────────────────────────

export interface PlayerCareerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  position: string;
  seasonsPlayed: number;
  totalGames: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalCs: number;
  totalDamage: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number;
  /** 우승 횟수 */
  championshipCount: number;
  /** MVP 수상 횟수 */
  mvpCount: number;
}

export interface HallOfFameEligibility {
  playerId: string;
  eligible: boolean;
  reasons: string[];
  stats: {
    mvpCount: number;
    championshipCount: number;
    totalGames: number;
  };
}

/**
 * 선수 커리어 통산 기록 (player_game_stats에서 집계)
 * 우승 횟수, MVP 수상 횟수 포함
 */
export async function getPlayerCareerStats(playerId: string): Promise<PlayerCareerStats | null> {
  const db = await getDatabase();

  const rows = await db.select<CareerStatsRow[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      pgs.position,
      COUNT(DISTINCT m.season_id) as seasons_played,
      COUNT(*) as total_games,
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
    WHERE pgs.player_id = $1
    GROUP BY pgs.player_id`,
    [playerId],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  const kda = row.total_deaths === 0
    ? row.total_kills + row.total_assists
    : (row.total_kills + row.total_assists) / row.total_deaths;

  // 우승 횟수: hall_of_fame에서 champion 타입이면서 해당 선수의 팀이 우승한 횟수
  // 또는 awards 테이블의 champion 항목 집계
  const championRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM hall_of_fame
     WHERE record_type = 'champion' AND (player_id = $1 OR team_id IN (
       SELECT DISTINCT pgs2.team_id FROM player_game_stats pgs2 WHERE pgs2.player_id = $1
     ))`,
    [playerId],
  );
  const championshipCount = championRows[0]?.cnt ?? 0;

  // MVP 수상 횟수
  const mvpRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM awards
     WHERE award_type = 'mvp' AND player_id = $1`,
    [playerId],
  );
  const mvpCount = mvpRows[0]?.cnt ?? 0;

  return {
    playerId: row.player_id,
    playerName: row.player_name,
    teamId: row.team_id,
    position: row.position,
    seasonsPlayed: row.seasons_played,
    totalGames: row.total_games,
    totalKills: row.total_kills,
    totalDeaths: row.total_deaths,
    totalAssists: row.total_assists,
    totalCs: row.total_cs,
    totalDamage: row.total_damage,
    avgKills: row.avg_kills,
    avgDeaths: row.avg_deaths,
    avgAssists: row.avg_assists,
    kda: Math.round(kda * 100) / 100,
    championshipCount,
    mvpCount,
  };
}

// ─────────────────────────────────────────
// 역대 기록 (All-Time Records)
// ─────────────────────────────────────────

export interface AllTimeRecord {
  category: string;
  playerId: string;
  playerName: string;
  teamId: string;
  value: number;
}

/**
 * 역대 기록 조회 (최다킬/최다승/최장연승 등)
 */
export async function getAllTimeRecords(): Promise<AllTimeRecord[]> {
  const db = await getDatabase();
  const records: AllTimeRecord[] = [];

  // 1. 통산 최다 킬
  const topKills = await db.select<AllTimeRecordRow[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      SUM(pgs.kills) as value
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    GROUP BY pgs.player_id
    ORDER BY value DESC
    LIMIT 5`,
  );
  for (const row of topKills) {
    records.push({
      category: '통산 최다 킬',
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      value: row.value,
    });
  }

  // 2. 통산 최다 어시스트
  const topAssists = await db.select<AllTimeRecordRow[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      SUM(pgs.assists) as value
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    GROUP BY pgs.player_id
    ORDER BY value DESC
    LIMIT 5`,
  );
  for (const row of topAssists) {
    records.push({
      category: '통산 최다 어시스트',
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      value: row.value,
    });
  }

  // 3. 통산 최고 KDA (최소 20경기)
  const topKda = await db.select<AllTimeRecordRow[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      ROUND(
        (SUM(pgs.kills) + SUM(pgs.assists)) * 1.0 / MAX(1, SUM(pgs.deaths)),
        2
      ) as value
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    GROUP BY pgs.player_id
    HAVING COUNT(*) >= 20
    ORDER BY value DESC
    LIMIT 5`,
  );
  for (const row of topKda) {
    records.push({
      category: '통산 최고 KDA',
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      value: row.value,
    });
  }

  // 4. 통산 최다 CS
  const topCs = await db.select<AllTimeRecordRow[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      SUM(pgs.cs) as value
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    GROUP BY pgs.player_id
    ORDER BY value DESC
    LIMIT 5`,
  );
  for (const row of topCs) {
    records.push({
      category: '통산 최다 CS',
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      value: row.value,
    });
  }

  // 5. 통산 최다 딜량
  const topDamage = await db.select<AllTimeRecordRow[]>(
    `SELECT
      pgs.player_id,
      p.name as player_name,
      pgs.team_id,
      SUM(pgs.damage_dealt) as value
    FROM player_game_stats pgs
    JOIN players p ON p.id = pgs.player_id
    GROUP BY pgs.player_id
    ORDER BY value DESC
    LIMIT 5`,
  );
  for (const row of topDamage) {
    records.push({
      category: '통산 최다 딜량',
      playerId: row.player_id,
      playerName: row.player_name,
      teamId: row.team_id,
      value: row.value,
    });
  }

  // 6. 팀 최다 승 (시즌별)
  const topTeamWins = await db.select<{ team_id: string; team_name: string; value: number; season_id: number }[]>(
    `SELECT
      sr.team_id,
      t.name as team_name,
      sr.wins as value,
      sr.season_id
    FROM season_records sr
    JOIN teams t ON t.id = sr.team_id
    ORDER BY sr.wins DESC
    LIMIT 5`,
  );
  for (const row of topTeamWins) {
    records.push({
      category: '시즌 최다 승',
      playerId: '',
      playerName: row.team_name,
      teamId: row.team_id,
      value: row.value,
    });
  }

  return records;
}

// ─────────────────────────────────────────
// 명예의 전당 자격 심사
// ─────────────────────────────────────────

/** 명예의 전당 등재 기준 */
const HALL_OF_FAME_CRITERIA = {
  /** 통산 MVP 수상 횟수 */
  minMvpCount: 2,
  /** 우승 횟수 */
  minChampionshipCount: 3,
  /** 통산 경기 수 */
  minTotalGames: 200,
};

/**
 * 명예의 전당 등재 자격 심사
 * - 통산 MVP 2회 이상 OR
 * - 우승 3회 이상 OR
 * - 통산 경기 200게임 이상
 */
export async function checkHallOfFameEligibility(
  playerId: string,
): Promise<HallOfFameEligibility> {
  const db = await getDatabase();

  // MVP 수상 횟수
  const mvpRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM awards WHERE award_type = 'mvp' AND player_id = $1`,
    [playerId],
  );
  const mvpCount = mvpRows[0]?.cnt ?? 0;

  // 우승 횟수 (해당 선수가 소속된 팀의 우승)
  const champRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM hall_of_fame
     WHERE record_type = 'champion' AND (player_id = $1 OR team_id IN (
       SELECT DISTINCT pgs.team_id FROM player_game_stats pgs WHERE pgs.player_id = $1
     ))`,
    [playerId],
  );
  const championshipCount = champRows[0]?.cnt ?? 0;

  // 통산 경기 수
  const gameRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM player_game_stats WHERE player_id = $1`,
    [playerId],
  );
  const totalGames = gameRows[0]?.cnt ?? 0;

  const reasons: string[] = [];

  if (mvpCount >= HALL_OF_FAME_CRITERIA.minMvpCount) {
    reasons.push(`통산 MVP ${mvpCount}회 수상`);
  }
  if (championshipCount >= HALL_OF_FAME_CRITERIA.minChampionshipCount) {
    reasons.push(`통산 우승 ${championshipCount}회`);
  }
  if (totalGames >= HALL_OF_FAME_CRITERIA.minTotalGames) {
    reasons.push(`통산 ${totalGames}경기 출전`);
  }

  return {
    playerId,
    eligible: reasons.length > 0,
    reasons,
    stats: { mvpCount, championshipCount, totalGames },
  };
}

/**
 * 시즌 종료 시 은퇴/명예의 전당 자동 심사 및 등재
 * - 은퇴 선수 목록을 받아 자격 심사
 * - 자격 충족 시 hall_of_fame에 자동 등재
 */
export async function checkAndInductHallOfFame(
  seasonId: number,
  retiredPlayerIds: string[],
  currentDate: string,
): Promise<HallOfFameEligibility[]> {
  const inducted: HallOfFameEligibility[] = [];

  for (const playerId of retiredPlayerIds) {
    const eligibility = await checkHallOfFameEligibility(playerId);

    if (eligibility.eligible) {
      // 이미 등재되어 있는지 확인
      const db = await getDatabase();
      const existing = await db.select<{ id: number }[]>(
        `SELECT id FROM hall_of_fame WHERE record_type = 'hall_of_fame' AND player_id = $1`,
        [playerId],
      );

      if (existing.length === 0) {
        await addHallOfFameEntry(
          seasonId,
          'hall_of_fame' as RecordType,
          playerId,
          null,
          null,
          `명예의 전당 자동 등재: ${eligibility.reasons.join(', ')}`,
          currentDate,
        );
      }

      inducted.push(eligibility);
    }
  }

  return inducted;
}
