/**
 * 선수 만족도 엔진
 * - 출전 시간, 급여, 팀 성적, 개인 성적, 역할 명확성, 케미스트리 기반
 * - 주간 만족도 체크 및 불만 생성
 * - 팀 만족도 리포트
 */

import { getDatabase } from '../../db/database';
import { clamp } from '../../utils/mathUtils';
import { getManagerIdentity, getManagerIdentityEffects } from '../manager/managerIdentityEngine';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface SatisfactionFactors {
  playtime: number;            // 0-100 (출전 비율 기반)
  salary: number;              // 0-100 (동급 대비)
  teamPerformance: number;     // 0-100 (팀 승률)
  personalPerformance: number; // 0-100 (개인 KDA 추세)
  roleClarity: number;        // 0-100 (주전/백업 명확성)
  teamChemistry: number;      // 0-100 (팀원 평균 케미)
}

export interface PlayerSatisfaction {
  playerId: string;
  overallSatisfaction: number; // 0-100
  factors: SatisfactionFactors;
}

export interface PlayerManagementInsight {
  playerId: string;
  overallSatisfaction: number;
  weakestFactor: keyof SatisfactionFactors;
  weakestScore: number;
  recommendation: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface RoleExpectationState {
  playerId: string;
  expectedRole: 'starter' | 'rotation' | 'prospect' | 'bench';
  actualRole: 'starter' | 'rotation' | 'prospect' | 'bench';
  mismatchScore: number;
  summary: string;
}

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface PlayerInfoRow {
  id: string;
  position: string;
  salary: number;
  mechanical: number;
  game_sense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
}

interface GamesPlayedRow {
  player_games: number;
  total_team_games: number;
}

interface SimilarSalaryRow {
  avg_salary: number;
}

interface TeamWinRateRow {
  wins: number;
  total: number;
}

interface RecentKDARow {
  kills: number;
  deaths: number;
  assists: number;
}

interface ChemistryRow {
  chemistry_score: number;
}

interface RelationAffinityRow {
  affinity: number;
}

interface SatisfactionRow {
  player_id: string;
  overall_satisfaction: number;
  playtime_satisfaction: number;
  salary_satisfaction: number;
  team_performance_satisfaction: number;
  personal_performance_satisfaction: number;
  role_clarity: number;
  team_chemistry_satisfaction: number;
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 만족도 가중치 */
export const FACTOR_WEIGHTS: Record<keyof SatisfactionFactors, number> = {
  playtime: 0.25,
  salary: 0.20,
  teamPerformance: 0.15,
  personalPerformance: 0.15,
  roleClarity: 0.10,
  teamChemistry: 0.15,
};

export const SATISFACTION_FACTOR_LABELS: Record<keyof SatisfactionFactors, string> = {
  playtime: '출전 시간',
  salary: '연봉 만족도',
  teamPerformance: '팀 성적',
  personalPerformance: '개인 경기력',
  roleClarity: '역할 명확성',
  teamChemistry: '팀 케미',
};

/** 불만 생성 임계값 */
export const COMPLAINT_THRESHOLD = 30;

/** 불만 유형 매핑 */
const FACTOR_TO_COMPLAINT_TYPE: Record<string, string> = {
  playtime: 'playtime',
  salary: 'salary',
  teamPerformance: 'morale',
  personalPerformance: 'morale',
  roleClarity: 'role',
  teamChemistry: 'morale',
};

/** 불만 메시지 템플릿 */
const COMPLAINT_MESSAGES: Record<string, string> = {
  playtime: '출전 기회가 너무 적습니다. 더 많은 경기에 출전하고 싶습니다.',
  salary: '현재 급여가 비슷한 수준의 다른 선수들에 비해 낮다고 느낍니다.',
  teamPerformance: '팀의 성적이 좋지 않아 걱정됩니다.',
  personalPerformance: '최근 경기력이 좋지 않아 자신감이 떨어집니다.',
  roleClarity: '팀 내 역할이 불명확합니다. 주전인지 백업인지 알고 싶습니다.',
  teamChemistry: '팀원들과의 소통이 잘 되지 않습니다.',
};

const MANAGEMENT_RECOMMENDATIONS: Record<keyof SatisfactionFactors, string> = {
  playtime: '출전 계획을 설명하거나 로테이션 방향을 면담에서 직접 조율하세요.',
  salary: '재계약 시기와 보상 계획을 미리 설명해 기대치를 관리하세요.',
  teamPerformance: '분위기 회복 면담과 함께 다음 경기 준비 우선순위를 다시 잡는 편이 좋습니다.',
  personalPerformance: '개인 훈련 포커스를 조정하고 부담을 줄일 수 있는 면담을 권장합니다.',
  roleClarity: '주전/백업 역할과 시즌 내 기대치를 명확하게 설명하세요.',
  teamChemistry: '갈등 여부를 확인하고 멘토링이나 팀 대화로 관계를 정리하세요.',
};

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function calculateOVR(player: PlayerInfoRow): number {
  return Math.round(
    (player.mechanical + player.game_sense + player.teamwork +
     player.consistency + player.laning + player.aggression) / 6,
  );
}

// ─────────────────────────────────────────
// 핵심 함수
// ─────────────────────────────────────────

/**
 * 개별 선수 만족도 산출
 */
export async function calculatePlayerSatisfaction(
  playerId: string,
  teamId: string,
  seasonId: number,
  saveId?: number,
): Promise<PlayerSatisfaction> {
  const db = await getDatabase();

  // 선수 기본 정보
  const playerRows = await db.select<PlayerInfoRow[]>(
    `SELECT id, position, salary, mechanical, game_sense, teamwork,
            consistency, laning, aggression
     FROM players WHERE id = $1`,
    [playerId],
  );

  if (playerRows.length === 0) {
    return createDefaultSatisfaction(playerId);
  }

  const player = playerRows[0];

  // 각 요소 병렬 산출
  const [playtime, salary, teamPerf, personalPerf, roleClarity, chemistry] =
    await Promise.all([
      calculatePlaytimeSatisfaction(db, playerId, teamId, seasonId),
      calculateSalarySatisfaction(db, player),
      calculateTeamPerformanceSatisfaction(db, teamId, seasonId),
      calculatePersonalPerformanceSatisfaction(db, playerId, seasonId),
      calculateRoleClaritySatisfaction(db, playerId, teamId),
      calculateChemistrySatisfaction(db, playerId),
    ]);

  const roleExpectationState = await getRoleExpectationState(playerId, teamId, seasonId, saveId).catch(() => null);
  const adjustedRoleClarity = roleExpectationState
    ? clamp(roleClarity - Math.round(roleExpectationState.mismatchScore * 0.4), 0, 100)
    : roleClarity;

  const factors: SatisfactionFactors = {
    playtime,
    salary,
    teamPerformance: teamPerf,
    personalPerformance: personalPerf,
    roleClarity: adjustedRoleClarity,
    teamChemistry: chemistry,
  };

  // 가중 평균으로 전체 만족도 산출
  const overall = Math.round(
    factors.playtime * FACTOR_WEIGHTS.playtime +
    factors.salary * FACTOR_WEIGHTS.salary +
    factors.teamPerformance * FACTOR_WEIGHTS.teamPerformance +
    factors.personalPerformance * FACTOR_WEIGHTS.personalPerformance +
    factors.roleClarity * FACTOR_WEIGHTS.roleClarity +
    factors.teamChemistry * FACTOR_WEIGHTS.teamChemistry,
  );

  return {
    playerId,
    overallSatisfaction: clamp(overall, 0, 100),
    factors,
  };
}

/**
 * 주간 만족도 체크 — satisfaction < 30이면 불만 생성
 */
export async function processWeeklySatisfaction(
  teamId: string,
  seasonId: number,
  currentDate: string,
  saveId?: number,
): Promise<void> {
  const db = await getDatabase();

  const playerRows = await db.select<{ id: string }[]>(
    'SELECT id FROM players WHERE team_id = $1',
    [teamId],
  );

  for (const row of playerRows) {
    const satisfaction = await calculatePlayerSatisfaction(row.id, teamId, seasonId, saveId);

    // DB 저장
    await db.execute(
      `INSERT INTO player_satisfaction
        (player_id, overall_satisfaction, playtime_satisfaction, salary_satisfaction,
         team_performance_satisfaction, personal_performance_satisfaction,
         role_clarity, team_chemistry_satisfaction, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT(player_id) DO UPDATE SET
         overall_satisfaction = $2, playtime_satisfaction = $3,
         salary_satisfaction = $4, team_performance_satisfaction = $5,
         personal_performance_satisfaction = $6, role_clarity = $7,
         team_chemistry_satisfaction = $8, last_updated = $9`,
      [
        row.id,
        satisfaction.overallSatisfaction,
        satisfaction.factors.playtime,
        satisfaction.factors.salary,
        satisfaction.factors.teamPerformance,
        satisfaction.factors.personalPerformance,
        satisfaction.factors.roleClarity,
        satisfaction.factors.teamChemistry,
        currentDate,
      ],
    );

    // 낮은 만족도 요소에 대해 불만 생성
    await generateComplaintsIfNeeded(db, row.id, teamId, seasonId, currentDate, satisfaction);
  }
}

/**
 * 팀 전체 만족도 리포트
 */
export async function getSatisfactionReport(
  teamId: string,
  seasonId?: number,
  saveId?: number,
): Promise<PlayerSatisfaction[]> {
  const db = await getDatabase();

  // DB 캐시에서 먼저 조회
  const cachedRows = await db.select<SatisfactionRow[]>(
    `SELECT ps.* FROM player_satisfaction ps
     JOIN players p ON p.id = ps.player_id
     WHERE p.team_id = $1`,
    [teamId],
  );

  if (cachedRows.length > 0) {
    return cachedRows.map((row) => ({
      playerId: row.player_id,
      overallSatisfaction: row.overall_satisfaction,
      factors: {
        playtime: row.playtime_satisfaction,
        salary: row.salary_satisfaction,
        teamPerformance: row.team_performance_satisfaction,
        personalPerformance: row.personal_performance_satisfaction,
        roleClarity: row.role_clarity,
        teamChemistry: row.team_chemistry_satisfaction,
      },
    }));
  }

  // 캐시 없으면 실시간 계산
  const activeSeasonId = seasonId ?? await getActiveSeasonId(db);
  if (activeSeasonId == null) return [];

  const playerRows = await db.select<{ id: string }[]>(
    'SELECT id FROM players WHERE team_id = $1',
    [teamId],
  );

  const results: PlayerSatisfaction[] = [];
  for (const row of playerRows) {
    results.push(await calculatePlayerSatisfaction(row.id, teamId, activeSeasonId, saveId));
  }

  return results;
}

export function buildManagementInsight(satisfaction: PlayerSatisfaction): PlayerManagementInsight {
  const factorEntries = Object.entries(satisfaction.factors) as [keyof SatisfactionFactors, number][];
  factorEntries.sort((a, b) => a[1] - b[1]);
  const [weakestFactor, weakestScore] = factorEntries[0];

  return {
    playerId: satisfaction.playerId,
    overallSatisfaction: satisfaction.overallSatisfaction,
    weakestFactor,
    weakestScore,
    recommendation: MANAGEMENT_RECOMMENDATIONS[weakestFactor],
    urgency: satisfaction.overallSatisfaction < 30 ? 'high' : satisfaction.overallSatisfaction < 50 ? 'medium' : 'low',
  };
}

export async function getPlayerManagementInsights(
  teamId: string,
  seasonId?: number,
  limit = 5,
  saveId?: number,
): Promise<PlayerManagementInsight[]> {
  const report = await getSatisfactionReport(teamId, seasonId, saveId);
  return report
    .map(buildManagementInsight)
    .sort((a, b) => a.overallSatisfaction - b.overallSatisfaction || a.weakestScore - b.weakestScore)
    .slice(0, limit);
}

function rankToExpectedRole(rank: number, closeToStarter: boolean, age: number, potential: number): RoleExpectationState['expectedRole'] {
  if (rank === 0) return 'starter';
  if (rank === 1 && closeToStarter) return 'rotation';
  if (age <= 20 || potential >= 82) return 'prospect';
  return 'bench';
}

function ratioToActualRole(ratio: number): RoleExpectationState['actualRole'] {
  if (ratio >= 0.75) return 'starter';
  if (ratio >= 0.35) return 'rotation';
  if (ratio >= 0.12) return 'prospect';
  return 'bench';
}

const ROLE_WEIGHT: Record<RoleExpectationState['expectedRole'], number> = {
  starter: 3,
  rotation: 2,
  prospect: 1,
  bench: 0,
};

export async function getRoleExpectationState(
  playerId: string,
  teamId: string,
  seasonId: number,
  saveId?: number,
): Promise<RoleExpectationState> {
  const db = await getDatabase();
  const [playerRows, positionRows, gamesRows, managerIdentity] = await Promise.all([
    db.select<Array<{ id: string; position: string; salary: number; age: number; potential: number; division: string | null; mechanical: number; game_sense: number; teamwork: number; consistency: number; laning: number; aggression: number }>>(
      `SELECT id, position, salary, age, potential, division, mechanical, game_sense, teamwork, consistency, laning, aggression
       FROM players
       WHERE id = $1
       LIMIT 1`,
      [playerId],
    ),
    db.select<Array<{ id: string; position: string; salary: number; age: number; potential: number; mechanical: number; game_sense: number; teamwork: number; consistency: number; laning: number; aggression: number }>>(
      `SELECT id, position, salary, age, potential, mechanical, game_sense, teamwork, consistency, laning, aggression
       FROM players
       WHERE team_id = $1
         AND position = (SELECT position FROM players WHERE id = $2 LIMIT 1)`,
      [teamId, playerId],
    ),
    db.select<GamesPlayedRow[]>(
      `SELECT
         (SELECT COUNT(DISTINCT match_id) FROM player_game_stats
          WHERE player_id = $1
            AND match_id IN (SELECT id FROM matches WHERE season_id = $3)) as player_games,
         (SELECT COUNT(*) FROM matches
          WHERE season_id = $3 AND is_played = 1
            AND (team_home_id = $2 OR team_away_id = $2)) as total_team_games`,
      [playerId, teamId, seasonId],
    ),
    saveId ? getManagerIdentity(saveId).catch(() => null) : Promise.resolve(null),
  ]);

  const player = playerRows[0];
  if (!player) {
    return {
      playerId,
      expectedRole: 'rotation',
      actualRole: 'rotation',
      mismatchScore: 0,
      summary: 'Role expectation is currently neutral.',
    };
  }

  const sortedPeers = [...positionRows].sort((left, right) => {
    const leftOvr = calculateOVR(left as PlayerInfoRow);
    const rightOvr = calculateOVR(right as PlayerInfoRow);
    return rightOvr - leftOvr;
  });
  const playerIndex = Math.max(0, sortedPeers.findIndex((row) => row.id === playerId));
  const playerOvr = calculateOVR(player as PlayerInfoRow);
  const starterOvr = sortedPeers[0] ? calculateOVR(sortedPeers[0] as PlayerInfoRow) : playerOvr;
  const closeToStarter = Math.abs(starterOvr - playerOvr) <= 4;
  let expectedRole = rankToExpectedRole(playerIndex, closeToStarter, player.age, player.potential);

  if (managerIdentity) {
    const identityEffects = getManagerIdentityEffects(managerIdentity.philosophy);
    if (identityEffects.playerMeetingBonus > 0 && player.potential >= 80 && expectedRole === 'bench') {
      expectedRole = 'prospect';
    }
    if (identityEffects.moraleRiskModifier > 0 && playerIndex === 0) {
      expectedRole = 'starter';
    }
  }

  const totalGames = gamesRows[0]?.total_team_games ?? 0;
  const playerGames = gamesRows[0]?.player_games ?? 0;
  const actualRatio = totalGames > 0 ? playerGames / totalGames : player.division === 'main' ? 0.7 : 0.15;
  const actualRole = ratioToActualRole(actualRatio);
  const mismatchScore = Math.max(0, (ROLE_WEIGHT[expectedRole] - ROLE_WEIGHT[actualRole]) * 18);
  const summary =
    mismatchScore >= 36
      ? '현재 출전 시간은 이 선수가 기대하는 역할보다 확실히 낮은 편입니다.'
      : mismatchScore >= 18
        ? '선수도 기대 역할과 실제 기용 사이의 차이를 서서히 느끼기 시작했습니다.'
        : '현재 역할 기대와 실제 기용은 대체로 맞아떨어지고 있습니다.';

  return {
    playerId,
    expectedRole,
    actualRole,
    mismatchScore,
    summary,
  };
}

// ─────────────────────────────────────────
// 만족도 요소별 산출
// ─────────────────────────────────────────

async function calculatePlaytimeSatisfaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  playerId: string,
  teamId: string,
  seasonId: number,
): Promise<number> {
  const rows = await db.select<GamesPlayedRow[]>(
    `SELECT
      (SELECT COUNT(DISTINCT match_id) FROM player_game_stats
       WHERE player_id = $1
         AND match_id IN (SELECT id FROM matches WHERE season_id = $3)) as player_games,
      (SELECT COUNT(*) FROM matches
       WHERE season_id = $3 AND is_played = 1
         AND (team_home_id = $2 OR team_away_id = $2)) as total_team_games`,
    [playerId, teamId, seasonId],
  );

  if (rows.length === 0 || rows[0].total_team_games === 0) return 50;

  const ratio = rows[0].player_games / rows[0].total_team_games;
  // 50% 이상 출전 → 높은 만족도, 20% 미만 → 낮은 만족도
  return clamp(Math.round(ratio * 100), 0, 100);
}

async function calculateSalarySatisfaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  player: PlayerInfoRow,
): Promise<number> {
  const ovr = calculateOVR(player);
  const ovrRange = 5;

  const rows = await db.select<SimilarSalaryRow[]>(
    `SELECT AVG(salary) as avg_salary FROM players
     WHERE position = $1
       AND (mechanical + game_sense + teamwork + consistency + laning + aggression) / 6
           BETWEEN $2 AND $3
       AND team_id IS NOT NULL`,
    [player.position, ovr - ovrRange, ovr + ovrRange],
  );

  if (rows.length === 0 || rows[0].avg_salary === 0) return 50;

  const ratio = player.salary / rows[0].avg_salary;
  // 급여가 평균의 120% 이상이면 만족(80+), 80% 미만이면 불만(30-)
  if (ratio >= 1.2) return clamp(Math.round(80 + (ratio - 1.2) * 50), 0, 100);
  if (ratio >= 0.8) return clamp(Math.round(30 + (ratio - 0.8) * 125), 0, 100);
  return clamp(Math.round(ratio * 37.5), 0, 100);
}

async function calculateTeamPerformanceSatisfaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  teamId: string,
  seasonId: number,
): Promise<number> {
  const rows = await db.select<TeamWinRateRow[]>(
    `SELECT
      SUM(CASE
        WHEN (team_home_id = $1 AND score_home > score_away)
          OR (team_away_id = $1 AND score_away > score_home) THEN 1
        ELSE 0 END) as wins,
      COUNT(*) as total
    FROM matches
    WHERE season_id = $2 AND is_played = 1
      AND (team_home_id = $1 OR team_away_id = $1)`,
    [teamId, seasonId],
  );

  if (rows.length === 0 || rows[0].total === 0) return 50;

  const winRate = rows[0].wins / rows[0].total;
  return clamp(Math.round(winRate * 100), 0, 100);
}

async function calculatePersonalPerformanceSatisfaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  playerId: string,
  seasonId: number,
): Promise<number> {
  const rows = await db.select<RecentKDARow[]>(
    `SELECT pgs.kills, pgs.deaths, pgs.assists
     FROM player_game_stats pgs
     JOIN matches m ON m.id = pgs.match_id
     WHERE pgs.player_id = $1 AND m.season_id = $2
     ORDER BY m.played_at DESC
     LIMIT 5`,
    [playerId, seasonId],
  );

  if (rows.length === 0) return 50;

  const totalK = rows.reduce((s, r) => s + r.kills, 0);
  const totalD = rows.reduce((s, r) => s + r.deaths, 0);
  const totalA = rows.reduce((s, r) => s + r.assists, 0);
  const kda = totalD === 0 ? totalK + totalA : (totalK + totalA) / totalD;

  // KDA 3.0 이상 → 80+, 1.0 미만 → 20
  return clamp(Math.round(20 + kda * 20), 0, 100);
}

async function calculateRoleClaritySatisfaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  playerId: string,
  teamId: string,
): Promise<number> {
  // 같은 포지션에 팀원이 있는지 확인
  const playerRows = await db.select<{ position: string }[]>(
    'SELECT position FROM players WHERE id = $1',
    [playerId],
  );
  if (playerRows.length === 0) return 50;

  const position = playerRows[0].position;
  const samePositionRows = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM players
     WHERE team_id = $1 AND position = $2 AND id != $3`,
    [teamId, position, playerId],
  );

  const competitors = samePositionRows.length > 0 ? samePositionRows[0].cnt : 0;

  // 경쟁자 없음 → 90, 1명 → 60, 2명 이상 → 30
  if (competitors === 0) return 90;
  if (competitors === 1) return 60;
  return 30;
}

async function calculateChemistrySatisfaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  playerId: string,
): Promise<number> {
  const [chemistryRows, relationRows] = await Promise.all([
    db.select<ChemistryRow[]>(
      `SELECT chemistry_score FROM player_chemistry
       WHERE player_a_id = $1 OR player_b_id = $1`,
      [playerId],
    ),
    db.select<RelationAffinityRow[]>(
      `SELECT affinity FROM player_relations
       WHERE player_id = $1`,
      [playerId],
    ),
  ]);

  if (chemistryRows.length === 0 && relationRows.length === 0) return 50;

  const chemistryAverage =
    chemistryRows.length > 0
      ? chemistryRows.reduce((sum, row) => sum + row.chemistry_score, 0) / chemistryRows.length
      : 50;
  const relationAverage =
    relationRows.length > 0
      ? relationRows.reduce((sum, row) => sum + row.affinity, 0) / relationRows.length
      : 50;

  return clamp(Math.round(chemistryAverage * 0.6 + relationAverage * 0.4), 0, 100);
}

// ─────────────────────────────────────────
// 불만 생성
// ─────────────────────────────────────────

async function generateComplaintsIfNeeded(
  db: Awaited<ReturnType<typeof getDatabase>>,
  playerId: string,
  teamId: string,
  seasonId: number,
  currentDate: string,
  satisfaction: PlayerSatisfaction,
): Promise<void> {
  if (satisfaction.overallSatisfaction >= COMPLAINT_THRESHOLD) return;

  // 가장 낮은 요소 찾기
  const entries = Object.entries(satisfaction.factors) as [keyof SatisfactionFactors, number][];
  entries.sort((a, b) => a[1] - b[1]);
  const [worstFactor] = entries[0];

  const complaintType = FACTOR_TO_COMPLAINT_TYPE[worstFactor] ?? 'morale';
  const message = COMPLAINT_MESSAGES[worstFactor] ?? '팀 상황에 불만이 있습니다.';

  // 같은 유형의 active 불만이 이미 있는지 확인
  const existingRows = await db.select<{ id: number }[]>(
    `SELECT id FROM player_complaints
     WHERE player_id = $1 AND team_id = $2 AND season_id = $3
       AND complaint_type = $4 AND status = 'active'`,
    [playerId, teamId, seasonId, complaintType],
  );

  if (existingRows.length > 0) return;

  // severity: 만족도 20 미만이면 심각(3), 25 미만이면 중간(2), 나머지 경미(1)
  const severity = satisfaction.overallSatisfaction < 20 ? 3
    : satisfaction.overallSatisfaction < 25 ? 2
    : 1;

  await db.execute(
    `INSERT INTO player_complaints
      (player_id, team_id, season_id, complaint_type, severity, message, status, created_date, morale_impact)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)`,
    [playerId, teamId, seasonId, complaintType, severity, message, currentDate, -severity * 3],
  );
}

// ─────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────

export function createDefaultSatisfaction(playerId: string): PlayerSatisfaction {
  return {
    playerId,
    overallSatisfaction: 50,
    factors: {
      playtime: 50,
      salary: 50,
      teamPerformance: 50,
      personalPerformance: 50,
      roleClarity: 50,
      teamChemistry: 50,
    },
  };
}

async function getActiveSeasonId(
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<number | null> {
  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM seasons WHERE is_active = 1 LIMIT 1',
  );
  return rows.length > 0 ? rows[0].id : null;
}
