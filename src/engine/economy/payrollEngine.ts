import { getDatabase } from '../../db/database';
import type { TeamPayrollSnapshot } from '../../types/systemDepth';

const MIN_SALARY_CAP = 22000;
const MAX_SALARY_CAP = 60000;
const REGION_CAP_MULTIPLIER = {
  LCK: 0.97,
  LPL: 1.08,
  LEC: 0.95,
  LCS: 1.04,
} as const;
const TIER_CAP_MULTIPLIER = {
  S: 1.12,
  A: 1.04,
  B: 0.95,
  C: 0.88,
} as const;
const REGION_TAX_PROFILE = {
  LCK: { taxedLimit: 0.09, warningLimit: 0.18, taxedRate: 0.3, warningRate: 0.65, warningBase: 500, hardRate: 1.1, hardBase: 1900 },
  LPL: { taxedLimit: 0.12, warningLimit: 0.25, taxedRate: 0.2, warningRate: 0.48, warningBase: 300, hardRate: 0.9, hardBase: 1400 },
  LEC: { taxedLimit: 0.09, warningLimit: 0.19, taxedRate: 0.28, warningRate: 0.62, warningBase: 450, hardRate: 1.05, hardBase: 1750 },
  LCS: { taxedLimit: 0.11, warningLimit: 0.24, taxedRate: 0.22, warningRate: 0.5, warningBase: 350, hardRate: 0.95, hardBase: 1500 },
} as const;
const STAFF_PAYROLL_WEIGHT = {
  head_coach: 1,
  coach: 0.9,
  analyst: 0.78,
  data_analyst: 0.76,
  scout_manager: 0.68,
  sports_psychologist: 0.62,
  nutritionist: 0.5,
  physiotherapist: 0.58,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRegionCapMultiplier(region?: string | null): number {
  if (!region) return 1;
  return REGION_CAP_MULTIPLIER[region as keyof typeof REGION_CAP_MULTIPLIER] ?? 1;
}

function inferFinancialTier(budget: number, reputation: number): keyof typeof TIER_CAP_MULTIPLIER {
  if (budget >= 600000 || reputation >= 85) return 'S';
  if (budget >= 420000 || reputation >= 68) return 'A';
  if (budget >= 260000 || reputation >= 48) return 'B';
  return 'C';
}

function getTierCapMultiplier(budget: number, reputation: number): number {
  return TIER_CAP_MULTIPLIER[inferFinancialTier(budget, reputation)];
}

function getRegionTaxProfile(region?: string | null) {
  if (!region) return REGION_TAX_PROFILE.LCK;
  return REGION_TAX_PROFILE[region as keyof typeof REGION_TAX_PROFILE] ?? REGION_TAX_PROFILE.LCK;
}

function getStaffPayrollWeight(role?: string | null): number {
  if (!role) return 0.65;
  return STAFF_PAYROLL_WEIGHT[role as keyof typeof STAFF_PAYROLL_WEIGHT] ?? 0.65;
}

export function calculateDynamicSalaryCap(budget: number, reputation: number, region?: string | null): number {
  const projectedCap = Math.round(
    (14500 + budget * 0.028 + reputation * 210) *
      getRegionCapMultiplier(region) *
      getTierCapMultiplier(budget, reputation),
  );
  return clamp(projectedCap, MIN_SALARY_CAP, MAX_SALARY_CAP);
}

export function evaluatePayrollImpact(params: {
  totalPayroll: number;
  salaryCap: number;
  region?: string | null;
}): Pick<TeamPayrollSnapshot, 'capRoom' | 'overage' | 'luxuryTax' | 'pressureBand'> {
  const capRoom = params.salaryCap - params.totalPayroll;
  const overage = Math.max(0, params.totalPayroll - params.salaryCap);

  if (overage <= 0) {
    return {
      capRoom,
      overage: 0,
      luxuryTax: 0,
      pressureBand: 'safe',
    };
  }

  const overageRatio = overage / Math.max(params.salaryCap, 1);
  const profile = getRegionTaxProfile(params.region);

  if (overageRatio <= profile.taxedLimit) {
    return {
      capRoom,
      overage,
      luxuryTax: Math.round(overage * profile.taxedRate),
      pressureBand: 'taxed',
    };
  }

  if (overageRatio <= profile.warningLimit) {
    return {
      capRoom,
      overage,
      luxuryTax: Math.round(overage * profile.warningRate + profile.warningBase),
      pressureBand: 'warning',
    };
  }

  return {
    capRoom,
    overage,
    luxuryTax: Math.round(overage * profile.hardRate + profile.hardBase),
    pressureBand: 'hard_stop',
  };
}

export async function getTeamSalaryCap(teamId: string): Promise<number> {
  const db = await getDatabase();
  const rows = await db.select<Array<{ budget: number; reputation: number; salary_cap: number; region: string | null }>>(
    'SELECT budget, reputation, salary_cap, region FROM teams WHERE id = $1 LIMIT 1',
    [teamId],
  );
  const team = rows[0];
  if (!team) return MIN_SALARY_CAP;

  const computedCap = calculateDynamicSalaryCap(team.budget, team.reputation, team.region);
  if (team.salary_cap !== computedCap) {
    await db.execute('UPDATE teams SET salary_cap = $1 WHERE id = $2', [computedCap, teamId]).catch(() => {});
  }
  return computedCap;
}

export async function getTeamPayrollSnapshot(teamId: string): Promise<TeamPayrollSnapshot> {
  const db = await getDatabase();
  const [teamRows, playerRows, staffRows, salaryCap] = await Promise.all([
    db.select<Array<{ budget: number; region: string | null }>>('SELECT budget, region FROM teams WHERE id = $1 LIMIT 1', [teamId]),
    db.select<Array<{ total: number | null }>>('SELECT SUM(salary) as total FROM players WHERE team_id = $1', [teamId]),
    db.select<Array<{ role: string | null; salary: number }>>('SELECT role, salary FROM staff WHERE team_id = $1', [teamId]),
    getTeamSalaryCap(teamId),
  ]);

  const currentBudget = teamRows[0]?.budget ?? 0;
  const region = teamRows[0]?.region ?? null;
  const playerSalaryTotal = playerRows[0]?.total ?? 0;
  const staffSalaryTotal = staffRows.reduce((sum, row) => sum + row.salary, 0);
  const effectiveStaffPayroll = Math.round(
    staffRows.reduce((sum, row) => sum + row.salary * getStaffPayrollWeight(row.role), 0),
  );
  const totalPayroll = playerSalaryTotal + effectiveStaffPayroll;
  const impact = evaluatePayrollImpact({ totalPayroll, salaryCap, region });

  return {
    teamId,
    currentBudget,
    salaryCap,
    playerSalaryTotal,
    staffSalaryTotal,
    effectiveStaffPayroll,
    totalPayroll,
    capRoom: impact.capRoom,
    overage: impact.overage,
    luxuryTax: impact.luxuryTax,
    pressureBand: impact.pressureBand,
  };
}
