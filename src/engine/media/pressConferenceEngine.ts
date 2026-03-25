/**
 * 기자회견/미디어 시스템
 * - 경기 전후 기자회견
 * - 발언 선택 → 여론/선수 사기/보드 반응
 * - 기자 질문 생성 + 답변 옵션
 */

import { getDatabase } from '../../db/database';
import { pickRandom, shuffleArray } from '../../utils/random';

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
    {
      question: '이번 경기의 핵심 포인트는 무엇이라고 보시나요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '초반 오브젝트 싸움이 승패를 가를 것입니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: 3, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '경기는 해봐야 알 수 있습니다. 변수가 많죠.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '상대의 강점을 얼마나 억제하느냐가 관건입니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '상대 팀과의 전적이 좋지 않은데 부담이 있나요?',
      category: 'rivalry',
      answers: [
        { id: 'a1', text: '과거 전적은 중요하지 않습니다. 오늘 새로운 경기입니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 1 } },
        { id: 'a2', text: '부담은 있지만 그만큼 이기고 싶은 마음이 큽니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 3, boardSatisfaction: 0, rivalryIntensity: 2 } },
        { id: 'a3', text: '전적에 대해서는 크게 신경 쓰지 않습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '주전 라인업에 변화가 있을 예정인가요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '최상의 라인업을 준비했습니다. 기대해주셔도 좋습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '라인업은 경기 직전에 공개하겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '모든 선수가 경쟁하고 있고, 컨디션을 보고 결정합니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '팬들이 이번 경기에 큰 기대를 걸고 있는데, 한 마디 해주시겠습니까?',
      category: 'general',
      answers: [
        { id: 'a1', text: '팬분들께 반드시 좋은 경기를 보여드리겠습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 4, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '팬분들의 응원이 큰 힘이 됩니다. 감사합니다.', tone: 'humble', effects: { teamMorale: 2, publicOpinion: 3, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '부담보다는 동기부여가 됩니다. 열심히 하겠습니다.', tone: 'honest', effects: { teamMorale: 2, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '최근 패치 변경이 팀 전략에 영향을 주었나요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '오히려 우리 팀에 유리한 패치입니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '패치에 맞춰 충분히 적응 훈련을 했습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '패치 관련 전략은 말씀드리기 어렵습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '상대 팀 감독과의 심리전에 대해 어떻게 생각하시나요?',
      category: 'rivalry',
      answers: [
        { id: 'a1', text: '심리전은 이미 시작됐습니다. 우리가 앞서고 있죠.', tone: 'aggressive', effects: { teamMorale: 2, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 4 } },
        { id: 'a2', text: '심리전보다 경기 준비에 집중하고 있습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '상대 감독은 존경합니다. 좋은 승부가 될 것입니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 3, boardSatisfaction: 0, rivalryIntensity: -1 } },
      ],
    },
    {
      question: '팀의 현재 컨디션은 어떻게 평가하시나요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '선수들 모두 최상의 컨디션입니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '몇몇 선수가 피로가 있지만 경기에는 문제없습니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '컨디션 세부사항은 공개하기 어렵습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '이번 경기에서 특별히 주목해야 할 선수가 있나요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '우리 팀 모든 선수가 주목할 만합니다. 누구든 활약할 수 있습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '최근 훈련에서 눈에 띄는 선수가 있는데, 경기에서 확인하시죠.', tone: 'deflect', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '개인보다 팀 전체의 조화가 중요합니다.', tone: 'humble', effects: { teamMorale: 2, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '드래프트 전략에 대해 힌트를 주실 수 있나요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '상대가 예상하지 못할 전략을 준비했습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 3, boardSatisfaction: 1, rivalryIntensity: 1 } },
        { id: 'a2', text: '드래프트는 상황에 따라 유동적으로 가져갑니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '기본에 충실한 드래프트를 할 예정입니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
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
    {
      question: '오늘 경기의 터닝 포인트는 어디였다고 보시나요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '우리 전략이 완벽하게 맞아떨어진 순간이 있었습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 3, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '한두 가지 판단 미스가 승패를 갈랐습니다. 반성하겠습니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 3, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '세부적인 분석은 내부적으로 하겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '오늘 MVP를 꼽는다면 누구인가요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '오늘은 팀 전체가 MVP였습니다.', tone: 'humble', effects: { teamMorale: 4, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '특정 선수보다 팀워크의 승리입니다.', tone: 'deflect', effects: { teamMorale: 2, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '솔직히 모든 선수가 아쉬운 경기였습니다.', tone: 'aggressive', effects: { teamMorale: -4, publicOpinion: 0, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '오늘 드래프트에 대한 평가를 해주신다면?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '드래프트에서 우위를 점했다고 생각합니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '드래프트가 아쉬웠습니다. 다음엔 보완하겠습니다.', tone: 'honest', effects: { teamMorale: -2, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '드래프트보다 운영에서 차이가 났습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '다음 경기에 대한 자신감은 어떤가요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '오늘 경기를 발판으로 더 좋은 경기를 하겠습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '한 경기 한 경기 겸손하게 임하겠습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '지금은 오늘 경기를 복기하는 게 먼저입니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '팬들에게 전하고 싶은 말이 있나요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '팬분들 덕분에 이길 수 있었습니다. 항상 감사합니다.', tone: 'humble', effects: { teamMorale: 3, publicOpinion: 5, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '팬분들께 실망을 드려 죄송합니다. 더 노력하겠습니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 3, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '앞으로 더 좋은 모습 보여드리겠습니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '오늘 패배 원인을 어디서 찾으시나요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '모든 책임은 감독인 제게 있습니다.', tone: 'honest', effects: { teamMorale: 2, publicOpinion: 5, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '선수들의 집중력이 부족했습니다. 강하게 이야기하겠습니다.', tone: 'aggressive', effects: { teamMorale: -6, publicOpinion: -1, boardSatisfaction: -1, rivalryIntensity: 0 } },
        { id: 'a3', text: '전체적으로 아쉬운 부분이 많았습니다. 복기하겠습니다.', tone: 'humble', effects: { teamMorale: 0, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '경기 중 선수들의 멘탈 관리는 어떻게 하셨나요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '선수들이 스스로 잘 컨트롤했습니다. 성숙해졌습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '중반에 흔들리는 순간이 있었지만 잘 잡아줬습니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '멘탈 관리는 팀 내부 사안이라 자세한 답변은 어렵습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '상대 팀의 전략에 대해 예상했던 부분이 있나요?',
      category: 'rivalry',
      answers: [
        { id: 'a1', text: '대부분 예상한 대로였습니다. 준비가 잘 되어 있었죠.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 2 } },
        { id: 'a2', text: '예상 밖의 전략이 있었습니다. 인정할 부분은 인정합니다.', tone: 'humble', effects: { teamMorale: -1, publicOpinion: 3, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '상대 전략 분석은 내부에서 진행하겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '이번 시즌 순위에 대한 전망은 어떤가요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '상위권 진입은 충분히 가능합니다. 자신 있습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 2, boardSatisfaction: 3, rivalryIntensity: 0 } },
        { id: 'a2', text: '순위보다 팀의 성장에 집중하고 있습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '아직 시즌이 많이 남았습니다. 단정짓기 이릅니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '경기 후 라커룸 분위기는 어땠나요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '승리의 기쁨을 나누면서도 다음 경기 준비에 집중했습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '아쉬움이 많았지만 서로 다독이며 정리했습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '라커룸 이야기는 팀 내부 사안입니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
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
    {
      question: '팀의 현재 순위에 만족하시나요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '만족하지 않습니다. 더 높은 곳을 목표로 하고 있습니다.', tone: 'aggressive', effects: { teamMorale: 2, publicOpinion: 3, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '과정을 즐기며 성장하고 있습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '순위보다 팀의 발전에 의미를 두고 있습니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '최근 팀 내 커뮤니케이션은 어떤 상태인가요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '선수들 간 소통이 매우 원활합니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '개선이 필요한 부분이 있어서 작업 중입니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '팀 내부 사안은 답변드리기 어렵습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '선수들의 솔로 랭크 성적을 관리하시나요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '솔로 랭크도 훈련의 일부입니다. 모니터링하고 있습니다.', tone: 'confident', effects: { teamMorale: -1, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '자율에 맡기되 최소한의 가이드라인은 있습니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '선수 개인 시간에 대해서는 간섭하지 않습니다.', tone: 'humble', effects: { teamMorale: 2, publicOpinion: 0, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '현재 메타에 대한 팀의 적응도는 어떤가요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '현 메타가 우리 팀 스타일에 잘 맞습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '메타 변화에 적응하는 중입니다. 시간이 좀 필요합니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '어떤 메타든 우리 스타일로 소화할 수 있습니다.', tone: 'aggressive', effects: { teamMorale: 2, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 1 } },
      ],
    },
    {
      question: '아카데미 선수 중 1군 승격이 기대되는 선수가 있나요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '유망한 선수들이 있습니다. 기대해주셔도 좋습니다.', tone: 'confident', effects: { teamMorale: -2, publicOpinion: 3, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '아직 1군 수준은 아니지만 꾸준히 성장 중입니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '아카데미 관련 사항은 별도로 말씀드리겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '다음 상대에 대한 준비는 어떻게 하고 계신가요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '이미 상대 분석을 마쳤습니다. 만반의 준비가 되어 있습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 1 } },
        { id: 'a2', text: '상대에 대한 분석과 자체 훈련을 병행하고 있습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '준비 과정은 공개하기 어렵습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '팀의 장기적인 비전에 대해 말씀해주시겠습니까?',
      category: 'general',
      answers: [
        { id: 'a1', text: '리그 최강팀이 되는 것이 목표입니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 3, boardSatisfaction: 3, rivalryIntensity: 0 } },
        { id: 'a2', text: '선수 육성과 팀 문화 구축에 중점을 두고 있습니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a3', text: '지금은 눈앞의 경기에 집중하겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '선수단의 체력 관리는 어떻게 하고 계신가요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '전문 트레이너와 함께 체계적으로 관리하고 있습니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '선수들의 건강이 최우선입니다. 무리하지 않게 조절하고 있습니다.', tone: 'honest', effects: { teamMorale: 2, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '선수 컨디션 세부사항은 팀 내부 사안입니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '최근 스크림 결과는 만족스러운가요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '스크림 성적이 매우 좋습니다. 자신감이 붙었습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '스크림은 스크림일 뿐입니다. 본 무대에서 증명하겠습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '스크림 결과는 비공개입니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
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
    {
      question: '최근 이적설이 도는 선수에 대해 한 말씀 해주시겠습니까?',
      category: 'transfer',
      answers: [
        { id: 'a1', text: '해당 선수는 우리 팀의 핵심입니다. 보낼 생각이 없습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a2', text: '모든 가능성은 열려 있습니다. 팀에 최선인 결정을 하겠습니다.', tone: 'honest', effects: { teamMorale: -3, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '이적설에 대해서는 코멘트하지 않겠습니다.', tone: 'evasive', effects: { teamMorale: -1, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '이번 오프시즌 로스터 변동 규모는 어느 정도인가요?',
      category: 'transfer',
      answers: [
        { id: 'a1', text: '큰 변화는 없을 것입니다. 현 로스터의 완성도를 높이겠습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 0, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '필요한 포지션에 대한 보강을 진행 중입니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '로스터 변동에 대해서는 확정 후 공지하겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '특정 포지션의 보강이 급하다는 평가가 있는데 동의하시나요?',
      category: 'transfer',
      answers: [
        { id: 'a1', text: '이미 해결책을 마련해두었습니다. 걱정하지 않으셔도 됩니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '인정합니다. 적극적으로 보강을 추진하고 있습니다.', tone: 'honest', effects: { teamMorale: -2, publicOpinion: 3, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '외부 평가에 일일이 반응하지는 않겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '해외 리그 선수 영입에 대한 생각은 어떠신가요?',
      category: 'transfer',
      answers: [
        { id: 'a1', text: '국적에 관계없이 최고의 선수를 영입하겠습니다.', tone: 'confident', effects: { teamMorale: -1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '국내 선수 육성을 우선으로 하되, 필요하면 해외도 고려합니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '영입 방향에 대해서는 말씀드리기 어렵습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: 'FA 계약이 만료되는 선수와의 재계약은 어떻게 진행되고 있나요?',
      category: 'transfer',
      answers: [
        { id: 'a1', text: '핵심 선수들과의 재계약은 순조롭게 진행 중입니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '양측 모두 좋은 조건을 찾기 위해 논의 중입니다.', tone: 'honest', effects: { teamMorale: 0, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '계약 관련 사항은 확정 전까지 비공개입니다.', tone: 'deflect', effects: { teamMorale: -1, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '이적 시장에서 라이벌 팀의 움직임을 어떻게 보시나요?',
      category: 'transfer',
      answers: [
        { id: 'a1', text: '어떤 보강을 하든 우리가 더 강합니다.', tone: 'aggressive', effects: { teamMorale: 2, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 3 } },
        { id: 'a2', text: '각 팀의 보강 상황을 주시하고 있습니다.', tone: 'honest', effects: { teamMorale: 0, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '다른 팀의 이적 사안에 대해서는 코멘트하지 않겠습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '신인 드래프트에서 눈여겨보는 선수가 있나요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '유망한 신인들을 면밀히 관찰하고 있습니다.', tone: 'confident', effects: { teamMorale: 0, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '드래프트는 팀의 미래를 위해 매우 중요하게 생각합니다.', tone: 'honest', effects: { teamMorale: 0, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '드래프트 관련 전략은 비공개입니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '현재 팀 예산 규모로 원하는 보강이 가능한가요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '구단에서 전폭적으로 지원해주고 있습니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: 2, boardSatisfaction: 3, rivalryIntensity: 0 } },
        { id: 'a2', text: '예산 내에서 최선의 선택을 할 것입니다.', tone: 'honest', effects: { teamMorale: 0, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '팀 재정에 대해서는 답변드리기 어렵습니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '떠나는 선수에게 전하고 싶은 말이 있나요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '함께한 시간에 감사하고, 새로운 곳에서도 잘 되길 바랍니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 4, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a2', text: '팀을 위한 결정이었습니다. 이해해주시길 바랍니다.', tone: 'honest', effects: { teamMorale: -1, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '개인적인 이야기는 자리를 바꿔서 하겠습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
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
    {
      question: '감독직 사퇴 의사는 없으신가요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '절대로 포기하지 않겠습니다. 끝까지 책임지겠습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 3, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '그 부분은 구단과 논의할 사안입니다.', tone: 'evasive', effects: { teamMorale: -5, publicOpinion: -2, boardSatisfaction: -2, rivalryIntensity: 0 } },
        { id: 'a3', text: '결과로 보여드리겠습니다. 조금만 기다려주십시오.', tone: 'honest', effects: { teamMorale: 2, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '선수단의 사기가 바닥이라는 보도가 있는데 사실인가요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '선수들은 여전히 의욕적입니다. 사실과 다릅니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a2', text: '어려운 시기인 건 맞지만, 서로 다독이며 버티고 있습니다.', tone: 'honest', effects: { teamMorale: 2, publicOpinion: 3, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '근거 없는 보도에 일일이 반응하지 않겠습니다.', tone: 'aggressive', effects: { teamMorale: 0, publicOpinion: -2, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '팀 내부 갈등설에 대해 어떻게 생각하시나요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '팀 내부는 단결되어 있습니다. 걱정하지 마십시오.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '의견 충돌은 있지만 건강한 토론입니다. 갈등과는 다릅니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 3, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '내부 사안에 대해서는 답변하지 않겠습니다.', tone: 'evasive', effects: { teamMorale: -2, publicOpinion: -2, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '전술적인 변화를 줄 계획이 있으신가요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '대대적인 전술 변화를 준비하고 있습니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: 3, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '기존 전술의 완성도를 높이는 방향으로 가겠습니다.', tone: 'humble', effects: { teamMorale: 1, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '전술은 결과가 아니라 실행이 문제입니다.', tone: 'aggressive', effects: { teamMorale: -4, publicOpinion: 0, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '구단 측에서 압박이 있나요?',
      category: 'general',
      answers: [
        { id: 'a1', text: '구단과 같은 방향을 보고 있습니다. 신뢰 관계가 탄탄합니다.', tone: 'confident', effects: { teamMorale: 2, publicOpinion: 1, boardSatisfaction: 3, rivalryIntensity: 0 } },
        { id: 'a2', text: '결과에 대한 책임감은 있지만, 압박이라고 느끼지는 않습니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '구단과의 관계는 내부 사안입니다.', tone: 'evasive', effects: { teamMorale: -1, publicOpinion: -1, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '위기를 극복하기 위한 구체적인 방안이 있나요?',
      category: 'tactics',
      answers: [
        { id: 'a1', text: '이미 구체적인 개선 계획을 세워 실행 중입니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 2, rivalryIntensity: 0 } },
        { id: 'a2', text: '문제점을 하나씩 짚어가며 해결하고 있습니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '세부 방안은 팀 내부에서 논의 중이라 공개하기 어렵습니다.', tone: 'deflect', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '팬들의 비판에 대해 어떻게 받아들이시나요?',
      category: 'performance',
      answers: [
        { id: 'a1', text: '팬분들의 비판은 당연합니다. 결과로 보답하겠습니다.', tone: 'honest', effects: { teamMorale: 1, publicOpinion: 5, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '비판을 겸허히 받아들이되, 흔들리지는 않겠습니다.', tone: 'confident', effects: { teamMorale: 3, publicOpinion: 2, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a3', text: '외부 의견에 신경 쓸 여유가 없습니다. 경기에 집중합니다.', tone: 'aggressive', effects: { teamMorale: 1, publicOpinion: -3, boardSatisfaction: -1, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '로스터 변경을 통해 돌파구를 찾을 생각은 없으신가요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '현 멤버들을 믿고 있습니다. 함께 이겨내겠습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 1, boardSatisfaction: 0, rivalryIntensity: 0 } },
        { id: 'a2', text: '모든 옵션을 검토하고 있습니다. 최선의 판단을 하겠습니다.', tone: 'honest', effects: { teamMorale: -3, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '로스터 관련 사항은 내부적으로 결정하겠습니다.', tone: 'deflect', effects: { teamMorale: -1, publicOpinion: 0, boardSatisfaction: 0, rivalryIntensity: 0 } },
      ],
    },
    {
      question: '이 상황에서 선수들에게 어떤 메시지를 전하고 계신가요?',
      category: 'player',
      answers: [
        { id: 'a1', text: '자신감을 잃지 말라고 합니다. 우리의 실력은 변하지 않았습니다.', tone: 'confident', effects: { teamMorale: 4, publicOpinion: 2, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a2', text: '각자의 역할에 충실하자고 이야기하고 있습니다.', tone: 'humble', effects: { teamMorale: 2, publicOpinion: 1, boardSatisfaction: 1, rivalryIntensity: 0 } },
        { id: 'a3', text: '선수들과 나누는 이야기는 라커룸에서만 합니다.', tone: 'evasive', effects: { teamMorale: 0, publicOpinion: -1, boardSatisfaction: 0, rivalryIntensity: 0 } },
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
  const shuffled = shuffleArray(pool);
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
    // performance
    'confident_performance': ['감독, "이번 시즌 자신 있다" 자신감 표출', '"우리 팀의 실력을 보여주겠다" — 감독 기자회견', '감독, 상위권 자신감 피력 — 팬들 기대감 상승'],
    'humble_performance': ['감독, 겸손한 자세로 시즌 임해', '"한 경기씩 최선을 다하겠다"', '감독, 결과보다 과정 강조 — 차분한 기자회견'],
    'honest_performance': ['감독, 솔직한 기자회견 — 팬들 호응', '"책임은 저에게 있습니다" — 진솔한 감독', '감독, 부진 인정하며 개선 약속'],
    'aggressive_performance': ['감독, 선수단에 질책 — 팀 내부 긴장', '"받아들일 수 없는 경기력" — 감독 분노', '감독, 강경 발언으로 선수단 각성 촉구'],
    'deflect_performance': ['감독, 성적 질문에 신중한 답변', '"과정을 지켜봐달라" — 감독, 구체적 답변 피해'],
    'evasive_performance': ['감독, 성적 관련 질문에 말 아껴', '기자회견서 감독 답변 짧아 — 팬들 아쉬움'],
    // rivalry
    'aggressive_rivalry': ['감독, 상대팀에 도발적 발언 — 라이벌 관계 격화', '"우리가 더 강하다" — 감독의 도발', '감독 도발 발언에 상대 팬 반발 — 라이벌전 흥행 예고'],
    'humble_rivalry': ['감독, 상대팀에 존경 표시 — 스포츠맨십 빛나', '"좋은 상대" — 감독의 겸손한 라이벌 평가'],
    'confident_rivalry': ['감독, 라이벌전 자신감 표출', '"준비는 완벽하다" — 감독, 라이벌전 앞두고 자신감'],
    'honest_rivalry': ['감독, 상대 강점 솔직히 인정', '"인정할 건 인정한다" — 감독의 솔직한 상대 평가'],
    // tactics
    'confident_tactics': ['감독, 전술 자신감 피력 — "준비된 전략 있다"', '감독, 새 전술 힌트 — 팬들 기대감 고조'],
    'humble_tactics': ['감독, 기본기 강조 — 화려함보다 안정성', '"기본에 충실하겠다" — 감독의 전술 철학'],
    'honest_tactics': ['감독, 전술 변화 필요성 인정', '감독, 솔직한 전술 평가 — 개선점 공개'],
    'deflect_tactics': ['감독, 전술 질문에 답변 거부 — "비공개"', '감독, 전략 노출 경계 — 기자들 아쉬움'],
    // player
    'confident_player': ['감독, 선수단 칭찬 — "최고의 멤버"', '감독, 선수들에 대한 신뢰 강조'],
    'humble_player': ['감독, 선수 개인보다 팀워크 강조', '"모든 선수가 중요하다" — 감독의 선수 관리 철학'],
    'honest_player': ['감독, 선수 컨디션 솔직 공개 — 팬들 관심', '감독, 선수 상태에 대해 솔직한 답변'],
    'aggressive_player': ['감독, 선수단에 쓴소리 — "각성이 필요하다"', '감독, 선수 질책 발언으로 긴장감 조성'],
    // general
    'confident_general': ['감독, 팀 분위기 최고 — 자신감 넘치는 기자회견', '감독, 긍정적 전망 제시 — 팬들 환호'],
    'humble_general': ['감독, 겸손한 자세로 팬 응원에 감사', '감독, 차분한 기자회견 — 안정된 리더십 과시'],
    'honest_general': ['감독, 팀 상황 솔직 공개 — 신뢰도 상승', '"있는 그대로 말씀드리겠습니다" — 감독의 투명한 소통'],
    'evasive_general': ['감독, 팀 내부 사안 언급 회피', '감독, 민감한 질문에 답변 자제'],
    // transfer
    'confident_transfer': ['감독, 현 로스터 자신감 — "보강 불필요"', '감독, 이적 시장 자신감 — "원하는 선수 데려올 것"'],
    'honest_transfer': ['감독, 보강 필요성 인정 — 이적 시장 적극 참여 예고', '감독, 솔직한 이적 시장 평가 — 팬들 주목'],
    'evasive_transfer': ['감독, 이적 관련 질문에 노코멘트', '감독, 이적설에 침묵 — 비밀주의 유지'],
    'aggressive_transfer': ['감독, 라이벌 보강에 강한 자신감 — "우리가 더 강하다"', '감독, 이적 시장 경쟁 의지 표명'],
    'deflect_transfer': ['감독, 이적 질문 회피 — "확정 후 알리겠다"', '이적 시장 관련 감독 입 굳게 닫아'],
  };

  const key = `${tone}_${category}`;
  const pool = headlines[key];
  if (!pool || pool.length === 0) return null;
  return pickRandom(pool);
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
