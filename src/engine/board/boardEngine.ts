/**
 * 보드(구단주) 기대치 & 팬 관리 엔진
 * - 시즌 목표 설정, 만족도 업데이트, 해고 위험도, 팬 반응 처리
 */

import type { BoardExpectation, FanReaction } from '../../types/board';
import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface BoardExpectationRow {
  id: number;
  team_id: string;
  season_id: number;
  target_standing: number;
  target_playoff: number;
  target_international: number;
  satisfaction: number;
  fan_happiness: number;
  warning_count: number;
  is_fired: number;
}

interface FanReactionRow {
  id: number;
  team_id: string;
  reaction_date: string;
  event_type: string;
  happiness_change: number;
  message: string | null;
  created_at: string;
}

// ─────────────────────────────────────────
// 매핑 유틸
// ─────────────────────────────────────────

function mapRowToBoardExpectation(row: BoardExpectationRow): BoardExpectation {
  return {
    teamId: row.team_id,
    seasonId: row.season_id,
    targetStanding: row.target_standing,
    targetPlayoff: Boolean(row.target_playoff),
    targetInternational: Boolean(row.target_international),
    satisfaction: row.satisfaction,
    fanHappiness: row.fan_happiness,
    warningCount: row.warning_count,
    isFired: Boolean(row.is_fired),
  };
}

function mapRowToFanReaction(row: FanReactionRow): FanReaction {
  return {
    id: row.id,
    teamId: row.team_id,
    reactionDate: row.reaction_date,
    eventType: row.event_type,
    happinessChange: row.happiness_change,
    message: row.message,
  };
}

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 명성 → 목표 순위 매핑 */
function getTargetStanding(reputation: number): number {
  if (reputation >= 90) return 1;
  if (reputation >= 80) return 2;
  if (reputation >= 70) return 3;
  if (reputation >= 55) return 4;
  if (reputation >= 40) return 6;
  return 8;
}

/** 명성 → 플레이오프 기대 여부 */
function expectsPlayoff(reputation: number): boolean {
  return reputation >= 55;
}

/** 명성 → 국제대회 기대 여부 */
function expectsInternational(reputation: number): boolean {
  return reputation >= 80;
}

/** 값을 0-100 범위로 클램프 */
function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 시즌 시작 시 구단주 기대치 초기화
 */
export async function initBoardExpectations(
  teamId: string,
  seasonId: number,
  reputation: number,
): Promise<BoardExpectation> {
  const db = await getDatabase();

  const targetStanding = getTargetStanding(reputation);
  const targetPlayoff = expectsPlayoff(reputation);
  const targetInternational = expectsInternational(reputation);
  const initialSatisfaction = 50;
  const initialFanHappiness = 50;

  await db.execute(
    `INSERT INTO board_expectations (team_id, season_id, target_standing, target_playoff, target_international, satisfaction, fan_happiness, warning_count, is_fired)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)
     ON CONFLICT(team_id, season_id) DO UPDATE SET
       target_standing = $3,
       target_playoff = $4,
       target_international = $5`,
    [teamId, seasonId, targetStanding, targetPlayoff ? 1 : 0, targetInternational ? 1 : 0, initialSatisfaction, initialFanHappiness],
  );

  return {
    teamId,
    seasonId,
    targetStanding,
    targetPlayoff,
    targetInternational,
    satisfaction: initialSatisfaction,
    fanHappiness: initialFanHappiness,
    warningCount: 0,
    isFired: false,
  };
}

/**
 * 순위 기반 만족도 업데이트
 */
export async function updateBoardSatisfaction(
  teamId: string,
  seasonId: number,
  currentStanding: number,
  wins: number,
  losses: number,
): Promise<BoardExpectation | null> {
  const expectations = await getBoardExpectations(teamId, seasonId);
  if (!expectations) return null;

  const totalGames = wins + losses;
  if (totalGames === 0) return expectations;

  const winRate = wins / totalGames;

  // 순위 차이 기반 만족도 조정
  const standingDiff = expectations.targetStanding - currentStanding;
  let satisfactionDelta = 0;

  if (standingDiff >= 0) {
    // 목표보다 좋은 순위 → 만족도 상승
    satisfactionDelta = Math.min(standingDiff * 3, 15);
  } else {
    // 목표보다 나쁜 순위 → 만족도 하락
    satisfactionDelta = Math.max(standingDiff * 4, -20);
  }

  // 승률 보정
  if (winRate >= 0.7) satisfactionDelta += 5;
  else if (winRate <= 0.3) satisfactionDelta -= 5;

  const newSatisfaction = clamp(expectations.satisfaction + satisfactionDelta);

  const db = await getDatabase();
  await db.execute(
    `UPDATE board_expectations SET satisfaction = $1 WHERE team_id = $2 AND season_id = $3`,
    [newSatisfaction, teamId, seasonId],
  );

  return { ...expectations, satisfaction: newSatisfaction };
}

/**
 * 경기 결과 반영
 */
export async function processMatchResult(
  teamId: string,
  seasonId: number,
  isWin: boolean,
  isUserMatch: boolean,
): Promise<BoardExpectation | null> {
  const expectations = await getBoardExpectations(teamId, seasonId);
  if (!expectations) return null;

  let satisfactionDelta = isWin ? 4 : -3;
  let fanDelta = isWin ? 5 : -3;

  // 유저 경기는 팬 반응 더 큼
  if (isUserMatch) {
    fanDelta = isWin ? 8 : -6;
  }

  // 연패 체크 (최근 팬 반응에서 패배 연속 확인)
  if (!isWin) {
    const recentReactions = await getFanReactions(teamId, 5);
    const recentLosses = recentReactions.filter(
      (r) => r.eventType === 'match_loss',
    );
    if (recentLosses.length >= 2) {
      satisfactionDelta -= 2;
      fanDelta -= 4;
    }
  }

  const newSatisfaction = clamp(expectations.satisfaction + satisfactionDelta);
  const newFanHappiness = clamp(expectations.fanHappiness + fanDelta);

  const db = await getDatabase();
  await db.execute(
    `UPDATE board_expectations SET satisfaction = $1, fan_happiness = $2 WHERE team_id = $3 AND season_id = $4`,
    [newSatisfaction, newFanHappiness, teamId, seasonId],
  );

  // 팬 반응 기록
  const eventType = isWin ? 'match_win' : 'match_loss';
  const message = isWin ? '팬들이 승리에 환호합니다!' : '팬들이 패배에 실망합니다.';
  await processFanReaction(teamId, new Date().toISOString().slice(0, 10), eventType, fanDelta, message);

  return { ...expectations, satisfaction: newSatisfaction, fanHappiness: newFanHappiness };
}

/**
 * 해고 위험도 체크
 * @returns 'safe' | 'warning' | 'fired'
 */
export async function checkFiringRisk(
  teamId: string,
  seasonId: number,
): Promise<'safe' | 'warning' | 'fired'> {
  const expectations = await getBoardExpectations(teamId, seasonId);
  if (!expectations) return 'safe';

  const db = await getDatabase();

  if (expectations.satisfaction <= 15) {
    // 해고
    await db.execute(
      `UPDATE board_expectations SET is_fired = 1 WHERE team_id = $1 AND season_id = $2`,
      [teamId, seasonId],
    );
    await processFanReaction(teamId, new Date().toISOString().slice(0, 10), 'fired', -20, '구단주가 감독을 해고했습니다.');
    return 'fired';
  }

  if (expectations.satisfaction <= 25) {
    // 경고
    const newWarningCount = expectations.warningCount + 1;
    await db.execute(
      `UPDATE board_expectations SET warning_count = $1 WHERE team_id = $2 AND season_id = $3`,
      [newWarningCount, teamId, seasonId],
    );
    await processFanReaction(teamId, new Date().toISOString().slice(0, 10), 'warning', -5, `구단주로부터 ${newWarningCount}번째 경고를 받았습니다.`);
    return 'warning';
  }

  return 'safe';
}

/**
 * 팬 반응 기록
 */
export async function processFanReaction(
  teamId: string,
  date: string,
  eventType: string,
  happinessChange: number,
  message: string | null,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO fan_reactions (team_id, reaction_date, event_type, happiness_change, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [teamId, date, eventType, happinessChange, message],
  );
}

/**
 * 구단주 기대치 조회
 */
export async function getBoardExpectations(
  teamId: string,
  seasonId: number,
): Promise<BoardExpectation | null> {
  const db = await getDatabase();
  const rows = await db.select<BoardExpectationRow[]>(
    `SELECT * FROM board_expectations WHERE team_id = $1 AND season_id = $2`,
    [teamId, seasonId],
  );

  if (rows.length === 0) return null;
  return mapRowToBoardExpectation(rows[0]);
}

/**
 * 최근 팬 반응 조회
 */
export async function getFanReactions(
  teamId: string,
  limit = 20,
): Promise<FanReaction[]> {
  const db = await getDatabase();
  const rows = await db.select<FanReactionRow[]>(
    `SELECT * FROM fan_reactions WHERE team_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [teamId, limit],
  );

  return rows.map(mapRowToFanReaction);
}
