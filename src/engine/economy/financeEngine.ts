/**
 * 재정 엔진 — 주급 지급, 스폰서십 수입, 경기 상금 처리
 */

import { FINANCIAL_CONSTANTS } from '../../data/systemPrompt';
import {
  getAllTeams,
  insertFinanceLog,
  processWeeklySalaries,
  getTeamFinanceSummary,
  type FinanceSummary,
} from '../../db/queries';
import { getDatabase } from '../../db/database';
import { processSponsorWeeklyIncome, expireSponsors } from './sponsorEngine';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 경기 승리 상금 (만 원 단위) */
const MATCH_WIN_PRIZE = 500;

/** reputation → 스폰서십 티어 매핑 */
function getSponsorshipTier(reputation: number): keyof typeof FINANCIAL_CONSTANTS.tierSupport {
  if (reputation >= 80) return 'S';
  if (reputation >= 60) return 'A';
  if (reputation >= 40) return 'B';
  return 'C';
}

/** 주간 스폰서십 수입 계산 (연간 수입 / 52주) */
function calculateWeeklySponsorshipIncome(reputation: number): number {
  const tier = getSponsorshipTier(reputation);
  const range = FINANCIAL_CONSTANTS.tierSupport[tier];
  // 연간 수입의 중간값 사용 (억 원 → 만 원 변환: × 10000)
  const annualIncome = ((range.min + range.max) / 2) * 10000;
  return Math.round(annualIncome / 52);
}

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 주간 재정 처리 (월요일에 호출)
 * 1. 모든 팀의 주급 지급
 * 2. 스폰서십 수입 지급
 */
export async function processWeeklyFinances(
  seasonId: number,
  gameDate: string,
): Promise<void> {
  // 1. 주급 지급 (모든 팀)
  await processWeeklySalaries(seasonId, gameDate);

  // 2. 스폰서십 수입 (모든 팀 — 자동 명성 기반)
  const teams = await getAllTeams();
  const db = await getDatabase();

  for (const team of teams) {
    const weeklyIncome = calculateWeeklySponsorshipIncome(team.reputation);
    if (weeklyIncome <= 0) continue;

    await insertFinanceLog(
      team.id,
      seasonId,
      gameDate,
      'income',
      'sponsorship',
      weeklyIncome,
      '주간 스폰서십 수입',
    );

    // 팀 budget 증가
    await db.execute(
      'UPDATE teams SET budget = budget + $1 WHERE id = $2',
      [weeklyIncome, team.id],
    );
  }

  // 3. 개별 스폰서 계약 수입 (계약이 있는 팀만)
  for (const team of teams) {
    await processSponsorWeeklyIncome(team.id, seasonId, gameDate);
  }

  // 4. 만료된 스폰서 일괄 정리
  for (const team of teams) {
    await expireSponsors(team.id, seasonId, gameDate);
  }
}

/**
 * 경기 승리 상금 처리
 */
export async function processMatchPrize(
  teamId: string,
  seasonId: number,
  gameDate: string,
  isWin: boolean,
): Promise<void> {
  if (!isWin) return;

  await insertFinanceLog(
    teamId,
    seasonId,
    gameDate,
    'income',
    'prize',
    MATCH_WIN_PRIZE,
    '경기 승리 상금',
  );

  // 팀 budget 증가
  const db = await getDatabase();
  await db.execute(
    'UPDATE teams SET budget = budget + $1 WHERE id = $2',
    [MATCH_WIN_PRIZE, teamId],
  );
}

/**
 * 팀 재정 현황 조회
 */
export async function getTeamFinancialStatus(
  teamId: string,
  seasonId: number,
): Promise<FinanceSummary> {
  return getTeamFinanceSummary(teamId, seasonId);
}
