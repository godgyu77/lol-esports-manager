import { getDatabase } from '../../db/database';
import { getTeamFinanceSummary, insertFinanceLog } from '../../db/queries';
import { getBoardExpectations } from '../board/boardEngine';
import { getActiveComplaints } from '../complaint/complaintEngine';
import { getTeamPayrollSnapshot } from '../economy/payrollEngine';
import {
  evaluateCareerArcProgress,
  getCareerArcEvents,
  getInternationalExpectationSnapshot,
  getRelationshipInfluenceSnapshot,
} from './releaseDepthEngine';
import type {
  BudgetPressureSnapshot,
  OngoingConsequence,
  PrepRecommendationRecord,
  RecurringExpense,
  TeamLoopRiskItem,
} from '../../types/systemDepth';

const WEEKLY_FIXED_EXPENSES = {
  facility: 280,
  staff: 140,
  operations: 120,
  matchPrep: 90,
} as const;

function addDaysIso(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function toJson(value: string[]): string {
  return JSON.stringify(value);
}

function fromJson(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function pressureLevel(score: number): BudgetPressureSnapshot['pressureLevel'] {
  if (score >= 72) return 'critical';
  if (score >= 40) return 'watch';
  return 'stable';
}

export function getRecurringExpenseSnapshot(playerSalaryTotal: number, staffSalaryTotal: number): RecurringExpense[] {
  return [
    {
      category: 'salary',
      amount: Math.round(playerSalaryTotal / 4),
      label: 'Weekly player wages',
    },
    {
      category: 'staff',
      amount: Math.round(staffSalaryTotal / 4),
      label: '코칭 및 지원 인건비',
    },
    {
      category: 'facility',
      amount: WEEKLY_FIXED_EXPENSES.facility,
      label: 'Facility upkeep',
    },
    {
      category: 'operations',
      amount: WEEKLY_FIXED_EXPENSES.operations,
      label: 'Operations overhead',
    },
    {
      category: 'match_prep',
      amount: WEEKLY_FIXED_EXPENSES.matchPrep,
      label: 'Travel and prep overhead',
    },
  ];
}

export async function getBudgetPressureSnapshot(
  teamId: string,
  seasonId: number,
): Promise<BudgetPressureSnapshot> {
  const [payrollSnapshot, financeSummary, board] = await Promise.all([
    getTeamPayrollSnapshot(teamId),
    getTeamFinanceSummary(teamId, seasonId),
    getBoardExpectations(teamId, seasonId).catch(() => null),
  ]);

  const currentBudget = payrollSnapshot.currentBudget;
  const recurring = getRecurringExpenseSnapshot(
    payrollSnapshot.playerSalaryTotal,
    payrollSnapshot.staffSalaryTotal,
  );
  const weeklyRecurringExpenses =
    recurring.reduce((sum, item) => sum + item.amount, 0) + payrollSnapshot.luxuryTax;
  const monthlyRecurringExpenses = weeklyRecurringExpenses * 4;
  const recentNegotiationCosts = financeSummary.logs
    .filter(
      (log) =>
        log.type === 'expense' &&
        ['negotiation_contact', 'failed_negotiation', 'agent_fee'].includes(log.category),
    )
    .slice(0, 12)
    .reduce((sum, log) => sum + log.amount, 0);
  const failedNegotiations = financeSummary.logs
    .filter((log) => log.type === 'expense' && log.category === 'failed_negotiation')
    .slice(0, 12).length;

  const runwayWeeks =
    weeklyRecurringExpenses > 0 ? currentBudget / Math.max(weeklyRecurringExpenses, 1) : 12;
  const budgetRisk =
    currentBudget < 0
      ? 52
      : runwayWeeks < 3
        ? 40
        : runwayWeeks < 6
          ? 28
          : runwayWeeks < 10
            ? 14
            : 4;
  const negotiationRisk =
    recentNegotiationCosts > 8000
      ? 18
      : recentNegotiationCosts > 4000
        ? 12
        : recentNegotiationCosts > 1500
          ? 5
          : 0;
  const negotiationCountRisk = failedNegotiations >= 4 ? 8 : failedNegotiations >= 2 ? 4 : 0;
  const payrollRisk =
    payrollSnapshot.pressureBand === 'hard_stop'
      ? 24
      : payrollSnapshot.pressureBand === 'warning'
        ? 14
        : payrollSnapshot.pressureBand === 'taxed'
          ? 6
          : 0;
  const boardRisk = board ? Math.max(4, 64 - board.satisfaction) : 8;
  const pressureScore = Math.max(
    0,
    Math.min(100, Math.round(budgetRisk + negotiationRisk + negotiationCountRisk + payrollRisk + boardRisk)),
  );

  const topDrivers: string[] = [];
  if (runwayWeeks < 10) topDrivers.push(`현금 활주로가 약 ${Math.max(1, Math.floor(runwayWeeks))}주 수준까지 줄었습니다.`);
  if (recentNegotiationCosts > 0) topDrivers.push(`최근 협상 실패와 접촉 비용으로 이미 ${recentNegotiationCosts.toLocaleString()}를 소진했습니다.`);
  if (failedNegotiations > 0) topDrivers.push(`최근 협상 ${failedNegotiations}건이 계약 없이 끝나며 매몰 비용만 남겼습니다.`);
  if (payrollSnapshot.overage > 0) {
    topDrivers.push(
      `연봉 총액이 상한을 ${payrollSnapshot.overage.toLocaleString()} 초과했고, 사치세 ${payrollSnapshot.luxuryTax.toLocaleString()}가 발생 중입니다.`,
    );
  }
  if (board && board.satisfaction <= 45) topDrivers.push('지출 압박이 뚜렷해지면서 보드의 인내심도 빠르게 줄고 있습니다.');
  if (topDrivers.length === 0) topDrivers.push('고정 지출은 아직 관리 가능한 범위입니다.');
  const boardPressureNote =
    !board
      ? '보드의 가시성은 제한적이지만 재정 압박은 계속 쌓이고 있습니다.'
      : pressureScore >= 65
        ? '보드는 더 공격적인 움직임 전에 즉각적인 비용 통제를 기대하고 있습니다.'
        : pressureScore >= 32
          ? '보드는 현재 지출을 면밀히 주시하고 있으며 추가 협상 실패에도 반응할 것입니다.'
          : '보드는 예산을 아직 안정적으로 보지만, 허술한 협상은 신뢰를 빠르게 깎아먹습니다.';

  return {
    currentBudget,
    weeklyRecurringExpenses,
    monthlyRecurringExpenses,
    recentNegotiationCosts,
    failedNegotiations,
    playerSalaryTotal: payrollSnapshot.playerSalaryTotal,
    staffSalaryTotal: payrollSnapshot.staffSalaryTotal,
    effectiveStaffPayroll: payrollSnapshot.effectiveStaffPayroll,
    salaryCap: payrollSnapshot.salaryCap,
    totalPayroll: payrollSnapshot.totalPayroll,
    capRoom: payrollSnapshot.capRoom,
    luxuryTax: payrollSnapshot.luxuryTax,
    runwayWeeks,
    pressureBand: payrollSnapshot.pressureBand,
    boardSatisfaction: board?.satisfaction ?? null,
    boardRisk,
    pressureScore,
    pressureLevel: pressureLevel(pressureScore),
    boardPressureNote,
    topDrivers,
  };
}

export async function applyBudgetPressureToBoard(
  teamId: string,
  seasonId: number,
): Promise<string | null> {
  const pressure = await getBudgetPressureSnapshot(teamId, seasonId);
  if (pressure.pressureLevel === 'stable') return null;

  const db = await getDatabase();
  const delta = pressure.pressureLevel === 'critical' ? -4 : -2;
  await db.execute(
    `UPDATE board_expectations
     SET satisfaction = MAX(0, satisfaction + $1)
     WHERE team_id = $2 AND season_id = $3`,
    [delta, teamId, seasonId],
  );

  return pressure.pressureLevel === 'critical'
    ? '보드는 분명한 예산 압박에 즉각 반응하고 있습니다.'
    : '보드는 점점 빡빡해지는 지출 상황을 감지하기 시작했습니다.';
}

export async function recordNegotiationExpense(params: {
  teamId: string;
  seasonId: number;
  gameDate: string;
  amount: number;
  category: 'negotiation_contact' | 'failed_negotiation';
  description: string;
}): Promise<void> {
  if (params.amount <= 0) return;
  const db = await getDatabase();
  await insertFinanceLog(
    params.teamId,
    params.seasonId,
    params.gameDate,
    'expense',
    params.category,
    params.amount,
    params.description,
  );
  await db.execute('UPDATE teams SET budget = budget - $1 WHERE id = $2', [params.amount, params.teamId]);
}

function mapPrepRow(row: {
  id: number;
  team_id: string;
  season_id: number;
  source: PrepRecommendationRecord['source'];
  focus_area: PrepRecommendationRecord['focusArea'];
  title: string;
  summary: string;
  recommended_changes: string;
  applied_changes: string;
  target_match_id: string | null;
  target_date: string | null;
  status: PrepRecommendationRecord['status'];
  observed_outcome: string | null;
  impact_summary: string | null;
  created_date: string;
  resolved_date: string | null;
}): PrepRecommendationRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    source: row.source,
    focusArea: row.focus_area,
    title: row.title,
    summary: row.summary,
    recommendedChanges: fromJson(row.recommended_changes),
    appliedChanges: fromJson(row.applied_changes),
    targetMatchId: row.target_match_id,
    targetDate: row.target_date,
    status: row.status,
    observedOutcome: row.observed_outcome,
    impactSummary: row.impact_summary,
    createdDate: row.created_date,
    resolvedDate: row.resolved_date,
  };
}

export async function recordPrepRecommendation(params: {
  teamId: string;
  seasonId: number;
  source: PrepRecommendationRecord['source'];
  focusArea: PrepRecommendationRecord['focusArea'];
  title: string;
  summary: string;
  recommendedChanges: string[];
  appliedChanges: string[];
  targetMatchId?: string | null;
  targetDate?: string | null;
  gameDate: string;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO prep_recommendation_records (
      team_id, season_id, source, focus_area, title, summary,
      recommended_changes, applied_changes, target_match_id, target_date, status, created_date
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'applied', $11)`,
    [
      params.teamId,
      params.seasonId,
      params.source,
      params.focusArea,
      params.title,
      params.summary,
      toJson(params.recommendedChanges),
      toJson(params.appliedChanges),
      params.targetMatchId ?? null,
      params.targetDate ?? null,
      params.gameDate,
    ],
  );
  return result.lastInsertId ?? 0;
}

export async function getPrepRecommendationRecords(
  teamId: string,
  seasonId: number,
  limit = 6,
): Promise<PrepRecommendationRecord[]> {
  const db = await getDatabase();
  const rows = await db.select<
    Array<{
      id: number;
      team_id: string;
      season_id: number;
      source: PrepRecommendationRecord['source'];
      focus_area: PrepRecommendationRecord['focusArea'];
      title: string;
      summary: string;
      recommended_changes: string;
      applied_changes: string;
      target_match_id: string | null;
      target_date: string | null;
      status: PrepRecommendationRecord['status'];
      observed_outcome: string | null;
      impact_summary: string | null;
      created_date: string;
      resolved_date: string | null;
    }>
  >(
    `SELECT *
     FROM prep_recommendation_records
     WHERE team_id = $1 AND season_id = $2
     ORDER BY created_date DESC, id DESC
     LIMIT $3`,
    [teamId, seasonId, limit],
  );

  return rows.map(mapPrepRow);
}

export async function resolvePrepRecommendations(teamId: string, seasonId: number): Promise<void> {
  const db = await getDatabase();
  const pendingRows = await db.select<
    Array<{
      id: number;
      target_match_id: string | null;
      target_date: string | null;
      focus_area: PrepRecommendationRecord['focusArea'];
    }>
  >(
    `SELECT id, target_match_id, target_date, focus_area
     FROM prep_recommendation_records
     WHERE team_id = $1
       AND season_id = $2
       AND status = 'applied'`,
    [teamId, seasonId],
  );

  for (const row of pendingRows) {
    const matchRows = await db.select<
      Array<{
        id: string;
        team_home_id: string;
        team_away_id: string;
        score_home: number;
        score_away: number;
        match_date: string | null;
      }>
    >(
      row.target_match_id
        ? `SELECT id, team_home_id, team_away_id, score_home, score_away, match_date
           FROM matches
           WHERE id = $1 AND is_played = 1
           LIMIT 1`
        : `SELECT id, team_home_id, team_away_id, score_home, score_away, match_date
           FROM matches
           WHERE (team_home_id = $1 OR team_away_id = $1)
             AND is_played = 1
             AND match_date >= $2
           ORDER BY match_date ASC
           LIMIT 1`,
      row.target_match_id ? [row.target_match_id] : [teamId, row.target_date ?? '0000-00-00'],
    );

    const match = matchRows[0];
    if (!match) continue;

    const won =
      (match.team_home_id === teamId && match.score_home > match.score_away) ||
      (match.team_away_id === teamId && match.score_away > match.score_home);

    const gameRows = await db.select<Array<{ gold_diff_at_15: number }>>(
      'SELECT gold_diff_at_15 FROM games WHERE match_id = $1 ORDER BY game_number ASC',
      [match.id],
    );
    const avgGoldDiff = gameRows.length
      ? Math.round(gameRows.reduce((sum, game) => sum + game.gold_diff_at_15, 0) / gameRows.length)
      : 0;
    const signedGoldDiff =
      match.team_home_id === teamId ? avgGoldDiff : avgGoldDiff * -1;

    const observedOutcome = won ? 'positive' : 'negative';
    const impactSummary =
      row.focus_area === 'training'
        ? won
          ? signedGoldDiff >= 0
            ? 'Training focus carried into the next match with cleaner early execution.'
            : 'The team still won, but the training change only paid off after a shaky early game.'
          : 'The training change did not hold up under match pressure and exposed preparation gaps.'
        : won
          ? signedGoldDiff >= 0
            ? 'The tactical adjustment lined up with the match flow and translated into a stronger game state.'
            : 'The tactical adjustment helped recover the match even after an uneven opening.'
          : 'The tactical adjustment was either read by the opponent or did not match the game state well enough.';

    await db.execute(
      `UPDATE prep_recommendation_records
       SET status = 'observed',
           observed_outcome = $2,
           impact_summary = $3,
           resolved_date = COALESCE($4, match_date)
       FROM matches
       WHERE prep_recommendation_records.id = $1
         AND matches.id = $5`,
      [row.id, observedOutcome, impactSummary, match.match_date, match.id],
    ).catch(async () => {
      await db.execute(
        `UPDATE prep_recommendation_records
         SET status = 'observed',
             observed_outcome = $2,
             impact_summary = $3,
             resolved_date = $4
         WHERE id = $1`,
        [row.id, observedOutcome, impactSummary, match.match_date],
      );
    });
  }
}

function mapConsequenceRow(row: {
  id: number;
  team_id: string;
  season_id: number;
  consequence_type: OngoingConsequence['consequenceType'];
  source: string;
  title: string;
  summary: string;
  severity: OngoingConsequence['severity'];
  started_date: string;
  expires_date: string;
  stat_key: string | null;
  stat_delta: number;
}): OngoingConsequence {
  return {
    id: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    consequenceType: row.consequence_type,
    source: row.source,
    title: row.title,
    summary: row.summary,
    severity: row.severity,
    startedDate: row.started_date,
    expiresDate: row.expires_date,
    statKey: row.stat_key,
    statDelta: row.stat_delta,
  };
}

export async function createOngoingConsequence(params: {
  teamId: string;
  seasonId: number;
  consequenceType: OngoingConsequence['consequenceType'];
  source: string;
  title: string;
  summary: string;
  severity: OngoingConsequence['severity'];
  startedDate: string;
  expiresDate: string;
  statKey?: string | null;
  statDelta?: number;
}): Promise<void> {
  const db = await getDatabase();
  const duplicate = await db.select<{ id: number }[]>(
    `SELECT id
     FROM ongoing_consequences
     WHERE team_id = $1
       AND season_id = $2
       AND title = $3
       AND expires_date >= $4
     LIMIT 1`,
    [params.teamId, params.seasonId, params.title, params.startedDate],
  );
  if (duplicate.length > 0) return;

  await db.execute(
    `INSERT INTO ongoing_consequences (
      team_id, season_id, consequence_type, source, title, summary, severity,
      started_date, expires_date, stat_key, stat_delta
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      params.teamId,
      params.seasonId,
      params.consequenceType,
      params.source,
      params.title,
      params.summary,
      params.severity,
      params.startedDate,
      params.expiresDate,
      params.statKey ?? null,
      params.statDelta ?? 0,
    ],
  );
}

export async function getActiveConsequences(
  teamId: string,
  seasonId: number,
  currentDate?: string,
): Promise<OngoingConsequence[]> {
  const db = await getDatabase();
  const rows = await db.select<
    Array<{
      id: number;
      team_id: string;
      season_id: number;
      consequence_type: OngoingConsequence['consequenceType'];
      source: string;
      title: string;
      summary: string;
      severity: OngoingConsequence['severity'];
      started_date: string;
      expires_date: string;
      stat_key: string | null;
      stat_delta: number;
    }>
  >(
    `SELECT *
     FROM ongoing_consequences
     WHERE team_id = $1
       AND season_id = $2
       AND ($3 IS NULL OR expires_date >= $3)
     ORDER BY
       CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       expires_date ASC`,
    [teamId, seasonId, currentDate ?? null],
  );
  return rows.map(mapConsequenceRow);
}

export async function expireOldConsequences(currentDate: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM ongoing_consequences WHERE expires_date < $1', [currentDate]);
}

export async function processSystemDepthDailyState(
  teamId: string,
  seasonId: number,
  currentDate: string,
  saveId?: number,
): Promise<string[]> {
  const [pressure, complaints, activeConsequences, relationshipSnapshot] = await Promise.all([
    getBudgetPressureSnapshot(teamId, seasonId),
    getActiveComplaints(teamId).catch(() => []),
    getActiveConsequences(teamId, seasonId, currentDate),
    getRelationshipInfluenceSnapshot(teamId, saveId).catch(() => null),
  ]);

  const created: string[] = [];
  if (pressure.pressureLevel === 'critical') {
    await createOngoingConsequence({
      teamId,
      seasonId,
      consequenceType: 'budget',
      source: 'finance',
      title: '예산 압박 심화',
      summary: '고정 지출이 활주로를 갉아먹고 있어, 새로운 협상 하나하나가 실제 보드 압박으로 이어지고 있습니다.',
      severity: 'high',
      startedDate: currentDate,
      expiresDate: addDaysIso(currentDate, 10),
      statKey: 'budget_pressure',
      statDelta: 8,
    });
    created.push('예산 압박이 이제 실제 운영 이슈로 번졌습니다.');
  }

  if (complaints.some((complaint) => complaint.severity >= 3)) {
    await createOngoingConsequence({
      teamId,
      seasonId,
      consequenceType: 'morale',
      source: 'complaints',
      title: 'Role tension in the room',
      summary: 'An unresolved complaint is starting to drag the mood of the room and can spill into preparation quality.',
      severity: 'medium',
      startedDate: currentDate,
      expiresDate: addDaysIso(currentDate, 7),
      statKey: 'morale',
      statDelta: -3,
    });
    created.push('A player issue is starting to affect team morale.');
  }

  if (relationshipSnapshot && (relationshipSnapshot.riskPairs.length > 0 || relationshipSnapshot.staffTrust <= 48)) {
    await createOngoingConsequence({
      teamId,
      seasonId,
      consequenceType: 'staff',
      source: 'relationship_network',
      title: 'Room chemistry watch',
      summary: relationshipSnapshot.summary,
      severity: relationshipSnapshot.riskPairs.length > 0 ? 'medium' : 'low',
      startedDate: currentDate,
      expiresDate: addDaysIso(currentDate, 8),
      statKey: 'morale',
      statDelta: relationshipSnapshot.riskPairs.length > 0 ? -2 : -1,
    });
    created.push('Relationship tension is becoming a live management issue.');
  }

  if (activeConsequences.length === 0 && pressure.pressureLevel === 'stable' && complaints.length === 0) {
    created.push('No long-tail issue is currently escalating.');
  }

  return created;
}

export async function getMainLoopRiskItems(
  teamId: string,
  seasonId: number,
  currentDate: string,
  saveId?: number,
): Promise<TeamLoopRiskItem[]> {
  const [pressure, consequences, prepRecords, relationshipSnapshot, internationalSnapshot, careerArcs] = await Promise.all([
    getBudgetPressureSnapshot(teamId, seasonId),
    getActiveConsequences(teamId, seasonId, currentDate),
    getPrepRecommendationRecords(teamId, seasonId, 3),
    getRelationshipInfluenceSnapshot(teamId, saveId).catch(() => null),
    getInternationalExpectationSnapshot(teamId, seasonId, null, saveId).catch(() => null),
    saveId != null ? getCareerArcEvents(saveId, teamId, 3).catch(() => []) : Promise.resolve([]),
  ]);

  const items: TeamLoopRiskItem[] = [
    {
      title: 'Budget pressure',
      summary: pressure.topDrivers[0] ?? 'Financial pressure is manageable.',
      tone:
        pressure.pressureLevel === 'critical'
          ? 'risk'
          : pressure.pressureLevel === 'watch'
            ? 'neutral'
            : 'positive',
    },
  ];

  if (consequences[0]) {
    items.push({
      title: consequences[0].title,
      summary: consequences[0].summary,
      tone: consequences[0].severity === 'high' ? 'risk' : 'neutral',
    });
  }

  if (prepRecords[0]) {
    items.push({
      title: prepRecords[0].title,
      summary: prepRecords[0].impactSummary ?? prepRecords[0].summary,
      tone: prepRecords[0].observedOutcome === 'positive' ? 'positive' : prepRecords[0].status === 'observed' ? 'risk' : 'neutral',
    });
  }

  if (relationshipSnapshot) {
    items.push({
      title: 'Room chemistry',
      summary: relationshipSnapshot.summary,
      tone: relationshipSnapshot.riskPairs.length > 0 ? 'risk' : relationshipSnapshot.strongPairs.length > 0 ? 'positive' : 'neutral',
    });
  }

  if (internationalSnapshot) {
    items.push({
      title: internationalSnapshot.label,
      summary: internationalSnapshot.summary,
      tone: internationalSnapshot.level === 'must_deliver' ? 'risk' : internationalSnapshot.level === 'contender' ? 'neutral' : 'positive',
    });
  }

  if (careerArcs[0]) {
    items.push({
      title: careerArcs[0].headline,
      summary: careerArcs[0].summary,
      tone: careerArcs[0].arcType === 'collapse' ? 'risk' : careerArcs[0].arcType === 'dynasty' ? 'positive' : 'neutral',
    });
  }

  return items.slice(0, 3);
}

export async function processReleaseDepthWeeklyState(
  saveId: number,
  teamId: string,
  seasonId: number,
  currentDate: string,
): Promise<string[]> {
  const created = await evaluateCareerArcProgress(saveId, teamId, seasonId, currentDate);
  return created.map((event) => event.headline);
}
