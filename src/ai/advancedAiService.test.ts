import { generateDailyBriefing, generateDraftAdvice, generateMatchCommentary } from './advancedAiService';

const { mockChatWithLlmJson, mockIsAiAvailable } = vi.hoisted(() => ({
  mockChatWithLlmJson: vi.fn(),
  mockIsAiAvailable: vi.fn(),
}));

vi.mock('./provider', () => ({
  chatWithLlmJson: mockChatWithLlmJson,
}));

vi.mock('./gameAiService', () => ({
  isAiAvailable: mockIsAiAvailable,
}));

vi.mock('./rag/ragEngine', () => ({
  augmentPromptWithKnowledge: vi.fn(async (prompt: string) => prompt),
}));

describe('advancedAiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AI 응답 스키마 검증이 실패하면 드래프트 조언을 템플릿으로 폴백한다', async () => {
    mockIsAiAvailable.mockResolvedValue(true);
    mockChatWithLlmJson.mockRejectedValue(new Error('schema mismatch'));

    const result = await generateDraftAdvice({
      phase: 'ban',
      turn: 1,
      myTeam: 'T1',
      opponentTeam: 'GEN',
      myBans: [],
      opponentBans: [],
      myPicks: [],
      opponentPicks: [],
      recommendedBans: ['Ahri'],
    });

    expect(result.suggestion.length).toBeGreaterThan(0);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('AI를 사용할 수 없으면 일일 브리핑을 규칙 기반으로 생성한다', async () => {
    mockIsAiAvailable.mockResolvedValue(false);

    const result = await generateDailyBriefing({
      teamName: 'T1',
      currentDate: '2026-04-01',
      nextOpponentName: 'GEN',
      nextMatchDate: '2026-04-02',
      teamMorale: 25,
      injuredPlayers: ['Faker'],
      recentForm: '2연패',
      lowSatisfactionPlayers: ['Keria'],
      activeConflicts: 1,
      budgetStatus: '부족',
    });

    expect(result.briefing.length).toBeGreaterThan(0);
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.advice.length).toBeGreaterThan(0);
  });

  it('AI 호출이 실패해도 경기 중계는 템플릿 자산으로 반환한다', async () => {
    mockIsAiAvailable.mockResolvedValue(true);
    mockChatWithLlmJson.mockRejectedValue(new Error('json parse failed'));

    const result = await generateMatchCommentary({
      phase: 'mid_game',
      event: 'teamfight',
      details: '미드 강가 한타',
      goldDiff: 1200,
      gameTime: 18,
      kills: { home: 8, away: 6 },
      teamName: 'T1',
    });

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.excitement).toBeGreaterThanOrEqual(1);
  });
});
