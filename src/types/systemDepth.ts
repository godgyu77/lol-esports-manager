export interface RecurringExpense {
  category: 'salary' | 'staff' | 'facility' | 'operations' | 'match_prep';
  amount: number;
  label: string;
}

export interface BudgetPressureSnapshot {
  currentBudget: number;
  weeklyRecurringExpenses: number;
  monthlyRecurringExpenses: number;
  recentNegotiationCosts: number;
  failedNegotiations: number;
  playerSalaryTotal: number;
  staffSalaryTotal: number;
  effectiveStaffPayroll: number;
  salaryCap: number;
  totalPayroll: number;
  capRoom: number;
  luxuryTax: number;
  runwayWeeks: number;
  pressureBand: 'safe' | 'taxed' | 'warning' | 'hard_stop';
  boardSatisfaction: number | null;
  boardRisk: number;
  pressureScore: number;
  pressureLevel: 'stable' | 'watch' | 'critical';
  boardPressureNote: string;
  topDrivers: string[];
}

export interface TeamPayrollSnapshot {
  teamId: string;
  currentBudget: number;
  salaryCap: number;
  playerSalaryTotal: number;
  staffSalaryTotal: number;
  effectiveStaffPayroll: number;
  totalPayroll: number;
  capRoom: number;
  overage: number;
  luxuryTax: number;
  pressureBand: 'safe' | 'taxed' | 'warning' | 'hard_stop';
}

export interface StaffFitSummary {
  staffId: number;
  name: string;
  role: string;
  preferredRole: string;
  fitScore: number;
  summary: string;
}

export interface PrepRecommendationRecord {
  id: number;
  teamId: string;
  seasonId: number;
  source: 'opponent_analysis' | 'coach_briefing' | 'post_match';
  focusArea: 'training' | 'tactics' | 'analysis';
  title: string;
  summary: string;
  recommendedChanges: string[];
  appliedChanges: string[];
  targetMatchId: string | null;
  targetDate: string | null;
  status: 'suggested' | 'applied' | 'observed' | 'expired';
  observedOutcome: string | null;
  impactSummary: string | null;
  createdDate: string;
  resolvedDate: string | null;
}

export interface OngoingConsequence {
  id: number;
  teamId: string;
  seasonId: number;
  consequenceType: 'morale' | 'budget' | 'staff' | 'media' | 'training';
  source: string;
  title: string;
  summary: string;
  severity: 'low' | 'medium' | 'high';
  startedDate: string;
  expiresDate: string;
  statKey: string | null;
  statDelta: number;
}

export interface TeamLoopRiskItem {
  title: string;
  summary: string;
  tone: 'positive' | 'neutral' | 'risk';
}

export type CareerArcType =
  | 'dynasty'
  | 'collapse'
  | 'rebuild'
  | 'legend_retirement'
  | 'icon_transition';

export type CareerArcStage = 'emerging' | 'active' | 'resolved';

export interface CareerArcEvent {
  id: number;
  saveId: number;
  teamId: string;
  seasonId: number;
  arcType: CareerArcType;
  stage: CareerArcStage;
  startedAt: string;
  resolvedAt: string | null;
  headline: string;
  summary: string;
  consequences: string[];
}

export interface RelationshipPairImpact {
  names: [string, string];
  score: number;
  tag: 'duo' | 'mentor' | 'rift';
}

export interface RelationshipInfluenceSnapshot {
  teamId: string;
  strongPairs: RelationshipPairImpact[];
  riskPairs: RelationshipPairImpact[];
  mentorLinks: RelationshipPairImpact[];
  staffTrust: number;
  moraleImpact: number;
  transferImpact: number;
  summary: string;
}

export type TeamHistoryLedgerType =
  | 'rivalry_record'
  | 'franchise_icon'
  | 'era_core'
  | 'retired_legend'
  | 'rival_defector'
  | 'icon_transition';

export interface TeamHistoryLedger {
  id: number;
  teamId: string;
  seasonId: number;
  ledgerType: TeamHistoryLedgerType;
  subjectId: string | null;
  subjectName: string;
  opponentTeamId: string | null;
  statValue: number;
  secondaryValue: number;
  note: string | null;
  extra: string[];
  updatedAt: string;
}

export interface InternationalExpectationSnapshot {
  teamId: string;
  seasonId: number;
  label: string;
  level: 'baseline' | 'contender' | 'must_deliver';
  summary: string;
  styleClash: string;
  boardPressureNote: string;
  legacyImpact: string;
  tags: string[];
}
