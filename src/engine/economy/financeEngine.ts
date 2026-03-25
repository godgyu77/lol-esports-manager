/**
 * 재정 엔진 — 주급 지급, 스폰서십 수입, 경기 상금 처리
 */

import { FINANCIAL_CONSTANTS } from '../../data/systemPrompt';
import {
  getAllTeams,
  getActiveSponsors,
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

/** 주간 고정 지출 (만 원 단위) */
const WEEKLY_FIXED_EXPENSES = {
  facility: 500,    // 시설 유지비
  staff: 300,       // 스태프 급여
  operations: 200,  // 숙소/운영비
} as const;
const WEEKLY_FIXED_TOTAL = WEEKLY_FIXED_EXPENSES.facility + WEEKLY_FIXED_EXPENSES.staff + WEEKLY_FIXED_EXPENSES.operations;

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
  // 중복 호출 방어: 해당 주에 이미 주급 지급 기록이 있으면 스킵
  const db0 = await getDatabase();
  const weekStart = gameDate; // 월요일 기준
  const existing = await db0.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM team_finance_log
     WHERE season_id = $1 AND game_date = $2 AND category = 'salary'`,
    [seasonId, weekStart],
  );
  if (existing.length > 0 && existing[0].cnt > 0) {
    return; // 이미 처리된 주
  }

  // 1. 주급 지급 (모든 팀)
  await processWeeklySalaries(seasonId, gameDate);

  // 2. [S11] 스폰서십 수입 — 활성 개별 스폰서 계약이 있으면 기본 명성 기반 스폰서십 스킵
  // 기본 스폰서십과 개별 스폰서 계약의 이중 수입을 방지
  const teams = await getAllTeams();
  const db = await getDatabase();

  for (const team of teams) {
    // 개별 스폰서 계약이 있는지 확인 → 있으면 기본 스폰서십 스킵
    const activeSponsors = await getActiveSponsors(team.id, seasonId);
    if (activeSponsors.length > 0) continue;

    const weeklyIncome = calculateWeeklySponsorshipIncome(team.reputation);
    if (weeklyIncome <= 0) continue;

    await insertFinanceLog(
      team.id,
      seasonId,
      gameDate,
      'income',
      'sponsorship',
      weeklyIncome,
      '주간 스폰서십 수입 (기본)',
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

  // 5. 구단주 투자 레벨에 따른 주간 지원금
  for (const team of teams) {
    try {
      const ownerRows = await db.select<{ investment_level: string }[]>(
        'SELECT investment_level FROM club_ownership WHERE team_id = $1 AND is_active = 1',
        [team.id],
      );
      if (ownerRows.length > 0) {
        const INVESTMENT_WEEKLY_BONUS: Record<string, number> = {
          low: 0, moderate: 200, high: 500, sugar_daddy: 1500,
        };
        const bonus = INVESTMENT_WEEKLY_BONUS[ownerRows[0].investment_level] ?? 0;
        if (bonus > 0) {
          await db.execute('UPDATE teams SET budget = budget + $1 WHERE id = $2', [bonus, team.id]);
          await insertFinanceLog(team.id, seasonId, gameDate, 'income', 'owner_investment', bonus, '구단주 주간 지원금');
        }
      }
    } catch { /* club_owners 테이블 없으면 무시 */ }
  }

  // 6. 고정 지출 (시설 유지비 + 스태프 급여 + 숙소/운영비)
  for (const team of teams) {
    await insertFinanceLog(
      team.id,
      seasonId,
      gameDate,
      'expense',
      'operations',
      WEEKLY_FIXED_TOTAL,
      `주간 고정 지출 (시설 ${WEEKLY_FIXED_EXPENSES.facility} + 스태프 ${WEEKLY_FIXED_EXPENSES.staff} + 운영 ${WEEKLY_FIXED_EXPENSES.operations})`,
    );

    await db.execute(
      'UPDATE teams SET budget = budget - $1 WHERE id = $2',
      [WEEKLY_FIXED_TOTAL, team.id],
    );
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
