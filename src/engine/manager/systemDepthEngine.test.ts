import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getBudgetPressureSnapshot, getMainLoopRiskItems } from './systemDepthEngine';

const {
  mockGetTeamPayrollSnapshot,
  mockGetTeamFinanceSummary,
  mockGetBoardExpectations,
  mockGetActiveComplaints,
  mockGetCareerArcEvents,
  mockGetInternationalExpectationSnapshot,
  mockGetRelationshipInfluenceSnapshot,
  mockGetDatabase,
} = vi.hoisted(() => ({
  mockGetTeamPayrollSnapshot: vi.fn(),
  mockGetTeamFinanceSummary: vi.fn(),
  mockGetBoardExpectations: vi.fn(),
  mockGetActiveComplaints: vi.fn(),
  mockGetCareerArcEvents: vi.fn(),
  mockGetInternationalExpectationSnapshot: vi.fn(),
  mockGetRelationshipInfluenceSnapshot: vi.fn(),
  mockGetDatabase: vi.fn(),
}));

vi.mock('../economy/payrollEngine', () => ({
  getTeamPayrollSnapshot: mockGetTeamPayrollSnapshot,
}));

vi.mock('../../db/queries', () => ({
  getTeamFinanceSummary: mockGetTeamFinanceSummary,
  insertFinanceLog: vi.fn(),
}));

vi.mock('../board/boardEngine', () => ({
  getBoardExpectations: mockGetBoardExpectations,
}));

vi.mock('../../db/database', () => ({
  getDatabase: mockGetDatabase,
}));

vi.mock('../complaint/complaintEngine', () => ({
  getActiveComplaints: mockGetActiveComplaints,
}));

vi.mock('./releaseDepthEngine', () => ({
  evaluateCareerArcProgress: vi.fn(),
  getCareerArcEvents: mockGetCareerArcEvents,
  getInternationalExpectationSnapshot: mockGetInternationalExpectationSnapshot,
  getRelationshipInfluenceSnapshot: mockGetRelationshipInfluenceSnapshot,
}));

describe('getBudgetPressureSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveComplaints.mockResolvedValue([]);
    mockGetCareerArcEvents.mockResolvedValue([]);
    mockGetInternationalExpectationSnapshot.mockResolvedValue(null);
    mockGetRelationshipInfluenceSnapshot.mockResolvedValue(null);
    mockGetDatabase.mockResolvedValue({
      select: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('enters watch pressure earlier when runway and failed talks tighten', async () => {
    mockGetTeamPayrollSnapshot.mockResolvedValue({
      currentBudget: 18000,
      playerSalaryTotal: 17000,
      staffSalaryTotal: 9000,
      effectiveStaffPayroll: 4500,
      salaryCap: 25000,
      totalPayroll: 21500,
      capRoom: 3500,
      overage: 0,
      luxuryTax: 0,
      pressureBand: 'safe',
    });
    mockGetTeamFinanceSummary.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      logs: [
        { type: 'expense', category: 'failed_negotiation', amount: 1800 },
        { type: 'expense', category: 'negotiation_contact', amount: 1200 },
      ],
    });
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 56 });

    const snapshot = await getBudgetPressureSnapshot('team-a', 1);

    expect(snapshot.pressureLevel).toBe('watch');
    expect(snapshot.failedNegotiations).toBe(1);
    expect(snapshot.runwayWeeks).toBeLessThan(10);
    expect(snapshot.boardPressureNote.length).toBeGreaterThan(0);
  });

  it('flags critical pressure when runway, board trust, and cap pressure all collapse', async () => {
    mockGetTeamPayrollSnapshot.mockResolvedValue({
      currentBudget: -5000,
      playerSalaryTotal: 24000,
      staffSalaryTotal: 16000,
      effectiveStaffPayroll: 8000,
      salaryCap: 25000,
      totalPayroll: 33000,
      capRoom: -8000,
      overage: 8000,
      luxuryTax: 1800,
      pressureBand: 'hard_stop',
    });
    mockGetTeamFinanceSummary.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      logs: [
        { type: 'expense', category: 'failed_negotiation', amount: 3000 },
        { type: 'expense', category: 'failed_negotiation', amount: 2800 },
        { type: 'expense', category: 'negotiation_contact', amount: 1900 },
      ],
    });
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 38 });

    const snapshot = await getBudgetPressureSnapshot('team-a', 1);

    expect(snapshot.pressureLevel).toBe('critical');
    expect(snapshot.pressureScore).toBeGreaterThanOrEqual(72);
    expect(snapshot.topDrivers.length).toBeGreaterThan(0);
    expect(snapshot.boardPressureNote.length).toBeGreaterThan(0);
  });
  it('surfaces carryover risk when multiple ongoing consequences stack into the next week', async () => {
    mockGetActiveComplaints.mockResolvedValue([]);
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 58 });
    mockGetRelationshipInfluenceSnapshot.mockResolvedValue(null);
    mockGetInternationalExpectationSnapshot.mockResolvedValue(null);
    mockGetCareerArcEvents.mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({
      select: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 21,
            team_id: 'team-a',
            season_id: 1,
            consequence_type: 'budget',
            source: 'finance',
            title: '예산 압박 후폭풍',
            summary: '지출 압박이 다음 일정까지 이어지고 있습니다.',
            severity: 'high',
            started_date: '2026-03-01',
            expires_date: '2026-03-12',
            stat_key: 'budget_pressure',
            stat_delta: 8,
          },
          {
            id: 22,
            team_id: 'team-a',
            season_id: 1,
            consequence_type: 'training',
            source: 'prep_chain',
            title: '준비 체인 흔들림',
            summary: '최근 준비 실패 여파가 아직 남아 있습니다.',
            severity: 'medium',
            started_date: '2026-03-02',
            expires_date: '2026-03-10',
            stat_key: 'prep_chain',
            stat_delta: -3,
          },
        ])
        .mockResolvedValueOnce([]),
      execute: vi.fn().mockResolvedValue(undefined),
    });

    const items = await getMainLoopRiskItems('team-a', 1, '2026-03-03');

    expect(items.some((item) => item.title === '누적 운영 후폭풍' && item.tone === 'risk')).toBe(true);
  });
});

describe('getMainLoopRiskItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTeamPayrollSnapshot.mockResolvedValue({
      currentBudget: 22000,
      playerSalaryTotal: 16000,
      staffSalaryTotal: 9000,
      effectiveStaffPayroll: 4500,
      salaryCap: 25000,
      totalPayroll: 20500,
      capRoom: 4500,
      overage: 0,
      luxuryTax: 0,
      pressureBand: 'safe',
    });
    mockGetTeamFinanceSummary.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      logs: [],
    });
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 62 });
    mockGetActiveComplaints.mockResolvedValue([
      { severity: 4, message: '주전 보장 약속이 지켜지지 않았다고 느낍니다.' },
    ]);
    mockGetRelationshipInfluenceSnapshot.mockResolvedValue(null);
    mockGetInternationalExpectationSnapshot.mockResolvedValue(null);
    mockGetCareerArcEvents.mockResolvedValue([]);
    mockGetDatabase.mockResolvedValue({
      select: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 11,
            team_id: 'team-a',
            season_id: 1,
            source: 'coach_briefing',
            focus_area: 'training',
            title: '훈련 조정',
            summary: '초반 교전 훈련 비중을 높였습니다.',
            recommended_changes: JSON.stringify(['초반 교전 반복']),
            applied_changes: JSON.stringify(['월요일 스크림 강화']),
            target_match_id: 'match-1',
            target_date: '2026-03-03',
            status: 'observed',
            observed_outcome: 'negative',
            impact_summary: '초반 교전 준비가 실제 경기에서 버티지 못했습니다.',
            created_date: '2026-03-02',
            resolved_date: '2026-03-03',
          },
          {
            id: 12,
            team_id: 'team-a',
            season_id: 1,
            source: 'opponent_analysis',
            focus_area: 'tactics',
            title: '전술 조정',
            summary: '오브젝트 중심 전술로 전환했습니다.',
            recommended_changes: JSON.stringify(['오브젝트 우선']),
            applied_changes: JSON.stringify(['드래곤 우선순위 상향']),
            target_match_id: 'match-1',
            target_date: '2026-03-03',
            status: 'applied',
            observed_outcome: null,
            impact_summary: null,
            created_date: '2026-03-02',
            resolved_date: null,
          },
        ]),
    });
  });

  it('surfaces prep-chain and complaint pressure in the main loop risk list', async () => {
    const items = await getMainLoopRiskItems('team-a', 1, '2026-03-03');

    expect(items.some((item) => item.title === '준비 체인 점검' && item.tone === 'risk')).toBe(true);
    expect(items.some((item) => item.title === '선수 불만 관리' && item.summary.includes('주전 보장'))).toBe(true);
  });

  it('prioritizes board and international pressure when both are in a danger state', async () => {
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 34 });
    mockGetInternationalExpectationSnapshot.mockResolvedValue({
      label: '국제전 시험대',
      summary: '이번 시즌은 국제전 성과가 곧 보드 평가로 이어집니다.',
      level: 'must_deliver',
    });
    mockGetRelationshipInfluenceSnapshot.mockResolvedValue({
      summary: '핵심 듀오 사이의 긴장이 커지고 있습니다.',
      staffTrust: 42,
      riskPairs: [{ names: ['A', 'B'] }],
      strongPairs: [],
      mentorLinks: [],
    });

    const items = await getMainLoopRiskItems('team-a', 1, '2026-03-03', 7);

    expect(items[0]?.title).toBe('보드 신뢰 경고');
    expect(items.some((item) => item.title === '국제전 압박' && item.tone === 'risk')).toBe(true);
    expect(items.length).toBe(3);
  });
});
