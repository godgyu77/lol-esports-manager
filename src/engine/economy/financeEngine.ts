/**
 * Finance engine for weekly payroll, sponsor income, and match prizes.
 */

import { FINANCIAL_CONSTANTS } from '../../data/systemPrompt';
import {
  getAllTeams,
  getActiveSponsors,
  getTeamFinanceSummary,
  insertFinanceLog,
  processWeeklySalaries,
  type FinanceSummary,
} from '../../db/queries';
import { getDatabase } from '../../db/database';
import { getTeamPayrollSnapshot } from './payrollEngine';
import { expireSponsors, processSponsorWeeklyIncome } from './sponsorEngine';

const MATCH_WIN_PRIZE = 500;

const WEEKLY_FIXED_EXPENSES = {
  facility: 500,
  operations: 200,
} as const;

const WEEKLY_FIXED_TOTAL =
  WEEKLY_FIXED_EXPENSES.facility + WEEKLY_FIXED_EXPENSES.operations;

function getSponsorshipTier(reputation: number): keyof typeof FINANCIAL_CONSTANTS.tierSupport {
  if (reputation >= 80) return 'S';
  if (reputation >= 60) return 'A';
  if (reputation >= 40) return 'B';
  return 'C';
}

function calculateWeeklySponsorshipIncome(reputation: number): number {
  const tier = getSponsorshipTier(reputation);
  const range = FINANCIAL_CONSTANTS.tierSupport[tier];
  const annualIncome = ((range.min + range.max) / 2) * 10000;
  return Math.round(annualIncome / 52);
}

export async function processWeeklyFinances(
  seasonId: number,
  gameDate: string,
): Promise<void> {
  const db = await getDatabase();
  const existing = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt
     FROM team_finance_log
     WHERE season_id = $1 AND game_date = $2 AND category = 'salary'`,
    [seasonId, gameDate],
  );
  if (existing[0]?.cnt > 0) return;

  await processWeeklySalaries(seasonId, gameDate);

  const teams = await getAllTeams();

  for (const team of teams) {
    const activeSponsors = await getActiveSponsors(team.id, seasonId);
    if (activeSponsors.length === 0) {
      const weeklyIncome = calculateWeeklySponsorshipIncome(team.reputation);
      if (weeklyIncome > 0) {
        await insertFinanceLog(
          team.id,
          seasonId,
          gameDate,
          'income',
          'sponsorship',
          weeklyIncome,
          'Weekly baseline sponsorship income',
        );
        await db.execute('UPDATE teams SET budget = budget + $1 WHERE id = $2', [weeklyIncome, team.id]);
      }
    }
  }

  for (const team of teams) {
    await processSponsorWeeklyIncome(team.id, seasonId, gameDate);
  }

  for (const team of teams) {
    await expireSponsors(team.id, seasonId, gameDate);
  }

  for (const team of teams) {
    try {
      const ownerRows = await db.select<{ investment_level: string }[]>(
        'SELECT investment_level FROM club_ownership WHERE team_id = $1 AND is_active = 1',
        [team.id],
      );
      if (ownerRows.length > 0) {
        const investmentWeeklyBonus: Record<string, number> = {
          low: 0,
          moderate: 200,
          high: 500,
          sugar_daddy: 1500,
        };
        const bonus = investmentWeeklyBonus[ownerRows[0].investment_level] ?? 0;
        if (bonus > 0) {
          await db.execute('UPDATE teams SET budget = budget + $1 WHERE id = $2', [bonus, team.id]);
          await insertFinanceLog(
            team.id,
            seasonId,
            gameDate,
            'income',
            'owner_investment',
            bonus,
            'Weekly owner investment support',
          );
        }
      }
    } catch {
      void 0;
    }
  }

  for (const team of teams) {
    const staffSalaryRows = await db.select<Array<{ total: number | null }>>(
      'SELECT SUM(salary) as total FROM staff WHERE team_id = $1',
      [team.id],
    );
    const weeklyStaffPayroll = Math.round((staffSalaryRows[0]?.total ?? 0) / 4);

    if (weeklyStaffPayroll > 0) {
      await insertFinanceLog(
        team.id,
        seasonId,
        gameDate,
        'expense',
        'coaching',
        weeklyStaffPayroll,
        'Weekly coaching and support payroll',
      );
      await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [weeklyStaffPayroll, team.id]);
    }

    await insertFinanceLog(
      team.id,
      seasonId,
      gameDate,
      'expense',
      'operations',
      WEEKLY_FIXED_TOTAL,
      `Weekly operating costs (facility ${WEEKLY_FIXED_EXPENSES.facility} + operations ${WEEKLY_FIXED_EXPENSES.operations})`,
    );
    await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [WEEKLY_FIXED_TOTAL, team.id]);

    const payrollSnapshot = await getTeamPayrollSnapshot(team.id);
    if (payrollSnapshot.luxuryTax > 0) {
      await insertFinanceLog(
        team.id,
        seasonId,
        gameDate,
        'expense',
        'penalty',
        payrollSnapshot.luxuryTax,
        `Luxury tax for payroll pressure (${payrollSnapshot.pressureBand})`,
      );
      await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [
        payrollSnapshot.luxuryTax,
        team.id,
      ]);
    }
  }
}

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
    'Match win prize',
  );

  const db = await getDatabase();
  await db.execute('UPDATE teams SET budget = budget + $1 WHERE id = $2', [MATCH_WIN_PRIZE, teamId]);
}

export async function getTeamFinancialStatus(
  teamId: string,
  seasonId: number,
): Promise<FinanceSummary> {
  return getTeamFinanceSummary(teamId, seasonId);
}
