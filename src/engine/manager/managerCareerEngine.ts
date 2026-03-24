/**
 * 감독 커리어 엔진
 * - 시즌별 성적 기록 저장/조회
 * - 명성(reputation) 산출
 * - 명예의 전당 자격 판정
 */

import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface ManagerCareerRecord {
  seasonId: number;
  teamId: string;
  teamName: string;
  year: number;
  split: string;
  wins: number;
  losses: number;
  standing: number;
  playoffResult: string | null;
  trophies: string[];
  wasFired: boolean;
}

export interface ManagerFameEligibility {
  eligible: boolean;
  totalTrophies: number;
  totalSeasons: number;
  reason: string;
}

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface CareerRow {
  id: number;
  save_id: number;
  season_id: number;
  team_id: string;
  team_name: string;
  year: number;
  split: string;
  wins: number;
  losses: number;
  standing: number;
  playoff_result: string | null;
  trophies: string | null;
  was_fired: number;
}

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

function mapRowToCareerRecord(row: CareerRow): ManagerCareerRecord {
  let trophies: string[] = [];
  if (row.trophies) {
    try {
      trophies = JSON.parse(row.trophies);
    } catch {
      trophies = [];
    }
  }

  return {
    seasonId: row.season_id,
    teamId: row.team_id,
    teamName: row.team_name,
    year: row.year,
    split: row.split,
    wins: row.wins,
    losses: row.losses,
    standing: row.standing,
    playoffResult: row.playoff_result,
    trophies,
    wasFired: row.was_fired === 1,
  };
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 명성 산출 가중치 */
const REPUTATION_WEIGHTS = {
  trophyBonus: 20,
  playoffBonus: 5,
  firingPenalty: -15,
  baseWinRateMultiplier: 50,
} as const;

/** 명예의 전당 기준 */
const FAME_THRESHOLDS = {
  trophyCount: 3,
  seasonCount: 10,
} as const;

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 시즌 성적 기록 저장
 */
export async function recordSeasonResult(
  saveId: number,
  seasonId: number,
  teamId: string,
  wins: number,
  losses: number,
  standing: number,
  playoffResult: string | null,
  trophies: string[],
): Promise<void> {
  const db = await getDatabase();

  // 시즌 정보 조회 (year, split)
  const seasonRows = await db.select<{ year: number; split: string }[]>(
    'SELECT year, split FROM seasons WHERE id = $1',
    [seasonId],
  );
  if (seasonRows.length === 0) {
    throw new Error(`시즌을 찾을 수 없습니다: ${seasonId}`);
  }
  const { year, split } = seasonRows[0];

  // 팀 이름 조회
  const teamRows = await db.select<{ name: string }[]>(
    'SELECT name FROM teams WHERE id = $1',
    [teamId],
  );
  const teamName = teamRows.length > 0 ? teamRows[0].name : teamId;

  await db.execute(
    `INSERT INTO manager_career (save_id, season_id, team_id, team_name, year, split, wins, losses, standing, playoff_result, trophies, was_fired)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
     ON CONFLICT(save_id, season_id) DO UPDATE SET
       wins = $7, losses = $8, standing = $9,
       playoff_result = $10, trophies = $11`,
    [saveId, seasonId, teamId, teamName, year, split, wins, losses, standing, playoffResult, JSON.stringify(trophies)],
  );
}

/**
 * 해고 기록
 */
export async function recordFiring(
  saveId: number,
  seasonId: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE manager_career SET was_fired = 1
     WHERE save_id = $1 AND season_id = $2`,
    [saveId, seasonId],
  );
}

/**
 * 감독 커리어 전체 이력 조회
 */
export async function getManagerCareer(
  saveId: number,
): Promise<ManagerCareerRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<CareerRow[]>(
    `SELECT * FROM manager_career
     WHERE save_id = $1
     ORDER BY year ASC, split ASC`,
    [saveId],
  );
  return rows.map(mapRowToCareerRecord);
}

/**
 * 감독 명성 산출
 * - 트로피: +20점
 * - 플레이오프 진출: +5점
 * - 승률 기반 보정: winRate * 50
 * - 해고: -15점
 */
export async function calculateManagerReputation(
  saveId: number,
): Promise<number> {
  const career = await getManagerCareer(saveId);
  if (career.length === 0) return 0;

  let reputation = 0;
  let totalWins = 0;
  let totalLosses = 0;

  for (const record of career) {
    // 트로피 보너스
    reputation += record.trophies.length * REPUTATION_WEIGHTS.trophyBonus;

    // 플레이오프 진출 보너스
    if (record.playoffResult != null) {
      reputation += REPUTATION_WEIGHTS.playoffBonus;
    }

    // 해고 패널티
    if (record.wasFired) {
      reputation += REPUTATION_WEIGHTS.firingPenalty;
    }

    totalWins += record.wins;
    totalLosses += record.losses;
  }

  // 승률 기반 보정
  const totalGames = totalWins + totalLosses;
  if (totalGames > 0) {
    const winRate = totalWins / totalGames;
    reputation += Math.round(winRate * REPUTATION_WEIGHTS.baseWinRateMultiplier);
  }

  return Math.max(0, reputation);
}

/**
 * 명예의 전당 자격 판정
 * - 트로피 3개 이상 또는
 * - 시즌 10회 이상
 */
export async function checkManagerFameEligibility(
  saveId: number,
): Promise<ManagerFameEligibility> {
  const career = await getManagerCareer(saveId);
  const totalSeasons = career.length;
  const totalTrophies = career.reduce((sum, r) => sum + r.trophies.length, 0);

  const trophyEligible = totalTrophies >= FAME_THRESHOLDS.trophyCount;
  const seasonEligible = totalSeasons >= FAME_THRESHOLDS.seasonCount;
  const eligible = trophyEligible || seasonEligible;

  let reason: string;
  if (trophyEligible && seasonEligible) {
    reason = `트로피 ${totalTrophies}개, ${totalSeasons}시즌 경력으로 자격 충족`;
  } else if (trophyEligible) {
    reason = `트로피 ${totalTrophies}개로 자격 충족`;
  } else if (seasonEligible) {
    reason = `${totalSeasons}시즌 경력으로 자격 충족`;
  } else {
    reason = `트로피 ${totalTrophies}/${FAME_THRESHOLDS.trophyCount}개, 시즌 ${totalSeasons}/${FAME_THRESHOLDS.seasonCount}회 — 미충족`;
  }

  return { eligible, totalTrophies, totalSeasons, reason };
}

// ─────────────────────────────────────────
// 멀티시즌 통계 / 연속성
// ─────────────────────────────────────────

/** 감독 커리어 요약 통계 */
export interface CareerSummary {
  totalSeasons: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalTrophies: number;
  trophyList: string[];
  teamsManaged: string[];
  bestStanding: number;
  worstStanding: number;
  longestTenure: { teamName: string; seasons: number };
  firingCount: number;
  playoffAppearances: number;
  reputationScore: number;
  /** 시즌별 승률 트렌드 (시각화용) */
  winRateTrend: { label: string; winRate: number }[];
  /** 시즌별 순위 트렌드 */
  standingTrend: { label: string; standing: number }[];
}

/**
 * 감독 커리어 요약 통계 생성 (시각화용)
 */
export async function getCareerSummary(saveId: number): Promise<CareerSummary> {
  const career = await getManagerCareer(saveId);
  const reputation = await calculateManagerReputation(saveId);

  let totalWins = 0;
  let totalLosses = 0;
  let totalTrophies = 0;
  const trophyList: string[] = [];
  const teamSet = new Set<string>();
  let bestStanding = 99;
  let worstStanding = 0;
  let firingCount = 0;
  let playoffAppearances = 0;

  // 시즌별 트렌드
  const winRateTrend: { label: string; winRate: number }[] = [];
  const standingTrend: { label: string; standing: number }[] = [];

  // 팀별 연속 재직 횟수
  const tenureMap = new Map<string, number>();

  for (const r of career) {
    totalWins += r.wins;
    totalLosses += r.losses;
    totalTrophies += r.trophies.length;
    trophyList.push(...r.trophies);
    teamSet.add(r.teamName);

    if (r.standing < bestStanding) bestStanding = r.standing;
    if (r.standing > worstStanding) worstStanding = r.standing;
    if (r.wasFired) firingCount++;
    if (r.playoffResult != null) playoffAppearances++;

    const total = r.wins + r.losses;
    const wr = total > 0 ? r.wins / total : 0;
    const label = `${r.year} ${r.split}`;
    winRateTrend.push({ label, winRate: Math.round(wr * 1000) / 10 });
    standingTrend.push({ label, standing: r.standing });

    tenureMap.set(r.teamName, (tenureMap.get(r.teamName) ?? 0) + 1);
  }

  // 최장 재직
  let longestTenure = { teamName: '-', seasons: 0 };
  for (const [teamName, seasons] of tenureMap) {
    if (seasons > longestTenure.seasons) {
      longestTenure = { teamName, seasons };
    }
  }

  const totalGames = totalWins + totalLosses;

  return {
    totalSeasons: career.length,
    totalWins,
    totalLosses,
    winRate: totalGames > 0 ? Math.round((totalWins / totalGames) * 1000) / 10 : 0,
    totalTrophies,
    trophyList,
    teamsManaged: Array.from(teamSet),
    bestStanding: bestStanding === 99 ? 0 : bestStanding,
    worstStanding,
    longestTenure,
    firingCount,
    playoffAppearances,
    reputationScore: reputation,
    winRateTrend,
    standingTrend,
  };
}

/** 역대 선수 레전드 기록 */
export interface LegendEntry {
  playerId: string;
  playerName: string;
  teamName: string;
  category: 'most_mvp' | 'most_kills' | 'longest_career' | 'most_titles' | 'highest_winrate';
  value: number;
  description: string;
}

/**
 * 역대 레전드 선수 조회 (DB 기반)
 * 각 카테고리별 1위 선수를 반환
 */
export async function getLegendPlayers(): Promise<LegendEntry[]> {
  const db = await getDatabase();
  const legends: LegendEntry[] = [];

  // 최다 킬 선수
  try {
    const killRows = await db.select<any[]>(
      `SELECT p.id, p.name, t.name as team_name, SUM(pgs.kills) as total_kills
       FROM player_game_stats pgs
       JOIN players p ON p.id = pgs.player_id
       LEFT JOIN teams t ON t.id = p.team_id
       GROUP BY pgs.player_id
       ORDER BY total_kills DESC LIMIT 1`,
    );
    if (killRows.length > 0) {
      legends.push({
        playerId: killRows[0].id,
        playerName: killRows[0].name,
        teamName: killRows[0].team_name ?? '무소속',
        category: 'most_kills',
        value: killRows[0].total_kills,
        description: `통산 ${killRows[0].total_kills}킬`,
      });
    }
  } catch { /* 테이블 미존재 시 무시 */ }

  // 최고 승률 (최소 10경기)
  try {
    const wrRows = await db.select<any[]>(
      `SELECT p.id, p.name, t.name as team_name,
              SUM(CASE WHEN pgs.result = 'win' THEN 1 ELSE 0 END) as wins,
              COUNT(*) as games
       FROM player_game_stats pgs
       JOIN players p ON p.id = pgs.player_id
       LEFT JOIN teams t ON t.id = p.team_id
       GROUP BY pgs.player_id
       HAVING games >= 10
       ORDER BY (CAST(wins AS REAL) / games) DESC LIMIT 1`,
    );
    if (wrRows.length > 0) {
      const wr = Math.round((wrRows[0].wins / wrRows[0].games) * 1000) / 10;
      legends.push({
        playerId: wrRows[0].id,
        playerName: wrRows[0].name,
        teamName: wrRows[0].team_name ?? '무소속',
        category: 'highest_winrate',
        value: wr,
        description: `승률 ${wr}% (${wrRows[0].games}경기)`,
      });
    }
  } catch { /* 무시 */ }

  return legends;
}
