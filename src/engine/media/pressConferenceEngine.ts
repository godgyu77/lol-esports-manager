/**
 * 기자회견/미디어 시스템
 * - 경기 전후 기자회견
 * - 발언 선택 → 여론/선수 사기/보드 반응
 * - 기자 질문 생성 + 답변 옵션
 */

import { getDatabase } from '../../db/database';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 기자회견 유형 */
export type ConferenceType = 'pre_match' | 'post_match' | 'weekly' | 'transfer' | 'crisis';

/** 기자 질문 */
export interface PressQuestion {
  id: string;
  /** 질문 텍스트 */
  question: string;
  /** 질문 카테고리 */
  category: 'performance' | 'transfer' | 'rivalry' | 'tactics' | 'player' | 'general';
  /** 답변 옵션 (3~4개) */
  answers: PressAnswer[];
}

/** 답변 옵션 */
export interface PressAnswer {
  id: string;
  text: string;
  /** 답변 톤 */
  tone: 'confident' | 'humble' | 'deflect' | 'aggressive' | 'honest' | 'evasive';
  /** 효과 */
  effects: PressAnswerEffects;
}

/** 답변 효과 */
export interface PressAnswerEffects {
  teamMorale: number;      // 팀 사기 변화 (-10 ~ +10)
  publicOpinion: number;   // 여론 변화 (-10 ~ +10)
  boardSatisfaction: number; // 보드 만족도 변화 (-5 ~ +5)
  rivalryIntensity: number;  // 라이벌 관계 강도 변화 (0 ~ +5)
  targetPlayerMorale?: number; // 특정 선수 사기 변화 (선수 관련 질문)
}

/** 기자회견 결과 */
export interface ConferenceResult {
  conferenceType: ConferenceType;
  questions: PressQuestion[];
  selectedAnswers: { questionId: string; answerId: string }[];
  totalEffects: PressAnswerEffects;
  /** 뉴스 헤드라인 생성 */
  headlines: string[];
}

// ─────────────────────────────────────────
// 질문 풀
// ─────────────────────────────────────────

const QUESTION_POOL: Record<ConferenceType, Omit<PressQuestion, 'id'>[]> = {
  pre_match: [
    {
      question: '이번 경기 상대에 대한 분석은 어떤가요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '상대의 약점을 충분히 파악했습니다. 자신 있습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 1 } },
        { id: 'a2', text: '강한 상대입니다. 최선을 다하겠습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '전술 내용은 공개할 수 없습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '현재 팀 분위기는 어떤가요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '팀 분위기가 최고입니다. 모든 선수가 의욕적입니다.', tone: 'confident', effects: { teamMorale: 5, publicOpinion: 3, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '꾸준히 개선되고 있습니다.', tone: 'honest', effects: { teamMorale: 2, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '어려운 시기지만 극복할 것입니다.', tone: 'humble', effects: { teamMorale: -1, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '이번 시즌 목표를 달성할 수 있다고 보시나요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '반드시 달성하겠습니다. 우리의 실력을 믿습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 3, boardSatisfaction: 3, rivalryIntensity: 0 } },
        { id: 'a2', text: '한 경기 한 경기에 집중하고 있습니다.', tone: 'deflect', effects: { teamMorale: 1, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '솔직히 쉽지 않지만 최선을 다하겠습니다.', tone: 'honest', effects: { teamMorale: -2, publicOpinion: 3, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
  ],
  post_match: [
    {
      question: '오늘 경기 결과에 대해 어떻게 생각하시나요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '선수들이 정말 잘 해주었습니다. 자랑스럽습니다.', tone: 'confident', effects: { teamMorale: 5, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '아쉬운 부분이 있지만 개선하겠습니다.', tone: 'honest', effects: { teamMorale: 0, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '받아들일 수 없는 경기력이었습니다.', tone: 'aggressive', effects: { teamMorale: -5, publicOpinion: 1, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '상대 팀에 대해 한 마디 해주시겠습니까?',
      category: 'rivalry',
      answers: [
        { id: 'a1', text: '좋은 팀입니다. 다음에 다시 만나고 싶습니다.', tone: 'humble', effects: { teamMorale: 0, publicOpinion: 3, boardSatisfaction: 0, rivalryIntensity: -1 } },
        { id: 'a2', text: '우리가 더 강한 팀이라는 것을 증명했습니다.', tone: 'aggressive', effects: { teamMorale: 3, publicOpinion: -2, boardSatisfaction: 0, rivalryIntensity: 3 } },
        { id: 'a3', text: '상대에 대해서는 코멘트하지 않겠습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
  ],
  weekly: [
    {
      question: '이번 주 훈련은 어떻게 진행되고 있나요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '새로운 전술을 연습 중이며 성과가 좋습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 1, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '기본기를 다지는 데 집중하고 있습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 0, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '훈련 내용은 비공개입니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -2, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
  ],
  transfer: [
    {
      question: '이적 시장에서 보강 계획이 있나요?',
      category: 'transfer',
      answers: [
        { id: 'a1', text: '현재 로스터에 만족합니다. 추가 영입은 없습니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a2', text: '항상 팀을 강화할 방법을 찾고 있습니다.', tone: 'honest', effects: { teamMorale: -2, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '이적 관련 사항은 답변드리기 어렵습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
  ],
  crisis: [
    {
      question: '최근 연패에 대해 어떻게 생각하시나요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '일시적인 슬럼프입니다. 곧 반등하겠습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 1, boardSatisfaction: -1, rivalryIntensity: 0 } },
        { id: 'a2', text: '책임은 저에게 있습니다. 해결하겠습니다.', tone: 'honest', effects: { teamMorale: 2, publicOpinion: 5, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a3', text: '선수들이 더 분발해야 합니다.', tone: 'aggressive', effects: { teamMorale: -8, publicOpinion: -3, boardSatisfaction: -2, rivalryIntensity: 0 } },
      ],
    },
  ],
};

// ─────────────────────────────────────────
// 질문 생성
// ─────────────────────────────────────────

/**
 * 기자회견 질문 생성
 * @param type 기자회견 유형
 * @param count 질문 수 (2~3개)
 * @returns 랜덤 질문 목록
 */
export function generateQuestions(type: ConferenceType, count = 2): PressQuestion[] {
  const pool = QUESTION_POOL[type] ?? QUESTION_POOL.weekly;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return selected.map((q, idx) => ({
    ...q,
    id: `q_${type}_${idx}`,
  }));
}

// ─────────────────────────────────────────
// 기자회견 결과 처리
// ─────────────────────────────────────────

/**
 * 기자회견 결과 계산
 * 선택된 답변들의 효과를 합산하고 뉴스 헤드라인 생성
 */
export function calculateConferenceResult(
  conferenceType: ConferenceType,
  questions: PressQuestion[],
  selectedAnswers: { questionId: string; answerId: string }[],
): ConferenceResult {
  const totalEffects: PressAnswerEffects = {
    teamMorale: 0,
    publicOpinion: 0,
    boardSatisfaction: 0,
    rivalryIntensity: 0,
  };

  const headlines: string[] = [];

  for (const selection of selectedAnswers) {
    const question = questions.find(q => q.id === selection.questionId);
    if (!question) continue;

    const answer = question.answers.find(a => a.id === selection.answerId);
    if (!answer) continue;

    totalEffects.teamMorale += answer.effects.teamMorale;
    totalEffects.publicOpinion += answer.effects.publicOpinion;
    totalEffects.boardSatisfaction += answer.effects.boardSatisfaction;
    totalEffects.rivalryIntensity += answer.effects.rivalryIntensity;

    // 헤드라인 생성
    const headline = generateHeadline(answer.tone, question.category);
    if (headline) headlines.push(headline);
  }

  return {
    conferenceType,
    questions,
    selectedAnswers,
    totalEffects,
    headlines,
  };
}

/** 답변 톤 + 카테고리 기반 뉴스 헤드라인 생성 */
function generateHeadline(tone: PressAnswer['tone'], category: PressQuestion['category']): string | null {
  const headlines: Record<string, string[]> = {
    'confident_performance': ['감독, "이번 시즌 자신 있다" 자신감 표출', '"우리 팀의 실력을 보여주겠다" — 감독 기자회견'],
    'humble_performance': ['감독, 겸손한 자세로 시즌 임해', '"한 경기씩 최선을 다하겠다"'],
    'aggressive_rivalry': ['감독, 상대팀에 도발적 발언 — 라이벌 관계 격화', '"우리가 더 강하다" — 감독의 도발'],
    'honest_performance': ['감독, 솔직한 기자회견 — 팬들 호응', '"책임은 저에게 있습니다" — 진솔한 감독'],
    'aggressive_performance': ['감독, 선수단에 질책 — 팀 내부 긴장', '"받아들일 수 없는 경기력" — 감독 분노'],
  };

  const key = `${tone}_${category}`;
  const pool = headlines[key];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 기자회견 결과 DB 저장 + 선수/보드 효과 적용
 */
export async function applyConferenceEffects(
  teamId: string,
  seasonId: number,
  result: ConferenceResult,
): Promise<void> {
  const db = await getDatabase();

  // 팀 사기 적용
  if (result.totalEffects.teamMorale !== 0) {
    await db.execute(
      'UPDATE players SET morale = MAX(0, MIN(100, morale + $1)) WHERE team_id = $2',
      [result.totalEffects.teamMorale, teamId],
    );
  }

  // 보드 만족도 적용
  if (result.totalEffects.boardSatisfaction !== 0) {
    await db.execute(
      `UPDATE board_expectations SET satisfaction = MAX(0, MIN(100, satisfaction + $1))
       WHERE team_id = $2 AND season_id = $3`,
      [result.totalEffects.boardSatisfaction, teamId, seasonId],
    );
  }

  // 팬 반응 적용
  if (result.totalEffects.publicOpinion !== 0) {
    await db.execute(
      `UPDATE board_expectations SET fan_happiness = MAX(0, MIN(100, fan_happiness + $1))
       WHERE team_id = $2 AND season_id = $3`,
      [result.totalEffects.publicOpinion, teamId, seasonId],
    );
  }
}
