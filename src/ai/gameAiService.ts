/**
 * 게임 AI 서비스
 * - Ollama 사용 가능 시 LLM 호출
 * - 불가 시 템플릿 폴백 자동 전환
 * - 일간 이벤트, 경기 후 코멘트, 이적 협상 판단
 */

import { checkOllamaStatus, chatWithLlmJson } from './provider';
import { getFallbackMeetingResponse, getFallbackPressResponse } from './fallback';
import { useSettingsStore } from '../stores/settingsStore';

// ─────────────────────────────────────────
// 상태 캐시
// ─────────────────────────────────────────

let _aiAvailable: boolean | null = null;

/** AI 사용 가능 여부 (캐시, 5분마다 재확인) */
let _lastCheck = 0;
const CHECK_INTERVAL = 5 * 60 * 1000;

async function isAiAvailable(): Promise<boolean> {
  // 설정에서 AI 비활성화 시 즉시 false 반환
  const { aiEnabled } = useSettingsStore.getState();
  if (!aiEnabled) return false;

  const now = Date.now();
  if (_aiAvailable !== null && now - _lastCheck < CHECK_INTERVAL) {
    return _aiAvailable;
  }
  _aiAvailable = await checkOllamaStatus();
  _lastCheck = now;
  return _aiAvailable;
}

// ─────────────────────────────────────────
// 일간 이벤트 생성
// ─────────────────────────────────────────

export interface DailyEvent {
  type: 'news' | 'team' | 'player' | 'injury' | 'morale';
  title: string;
  description: string;
  effect?: {
    targetPlayerId?: string;
    statChange?: Record<string, number>;
    moraleChange?: number;
  };
}

const FALLBACK_EVENTS: DailyEvent[] = [
  { type: 'team', title: '팀 분위기 좋음', description: '팀 전체가 좋은 분위기로 훈련에 임하고 있습니다.' },
  { type: 'news', title: '리그 소식', description: '다가오는 경기에 대한 팬들의 기대가 높아지고 있습니다.' },
  { type: 'team', title: '전략 회의', description: '코칭스태프가 다음 상대를 분석한 전략을 공유했습니다.' },
  { type: 'player', title: '개인 훈련 성과', description: '한 선수가 솔로랭크에서 좋은 성적을 거두었습니다.' },
  { type: 'morale', title: '팀 회식', description: '팀원들과 함께한 식사가 사기를 높여주었습니다.' },
];

/**
 * 일간 랜덤 이벤트 생성 (20% 확률)
 */
export async function generateDailyEvent(context: {
  teamName: string;
  playerNames: string[];
  currentDate: string;
  recentResults?: string; // "3승 1패" 등
}): Promise<DailyEvent | null> {
  // 20% 확률로 이벤트 발생
  if (Math.random() > 0.2) return null;

  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL e스포츠 매니저 게임의 이벤트 생성기입니다.
${context.teamName} 팀의 일상 이벤트를 하나 생성하세요.
날짜: ${context.currentDate}
선수: ${context.playerNames.join(', ')}
${context.recentResults ? `최근 성적: ${context.recentResults}` : ''}

JSON 형식으로 응답하세요:
{"type": "news|team|player|injury|morale", "title": "이벤트 제목 (10자 이내)", "description": "이벤트 설명 (50자 이내)"}`;

      return await chatWithLlmJson<DailyEvent>(prompt);
    } catch {
      // AI 실패 → 폴백
    }
  }

  // 폴백: 랜덤 템플릿
  return FALLBACK_EVENTS[Math.floor(Math.random() * FALLBACK_EVENTS.length)];
}

// ─────────────────────────────────────────
// 경기 후 코멘트 생성
// ─────────────────────────────────────────

export interface PostMatchComment {
  coachComment: string;
  headline: string;
}

const FALLBACK_WIN_COMMENTS: PostMatchComment[] = [
  { coachComment: '선수들이 준비한 대로 잘 해주었습니다.', headline: '완벽한 승리' },
  { coachComment: '팀워크가 빛난 경기였습니다.', headline: '팀워크의 승리' },
  { coachComment: '앞으로도 이 기세를 이어가겠습니다.', headline: '기세 이어가다' },
];

const FALLBACK_LOSS_COMMENTS: PostMatchComment[] = [
  { coachComment: '아쉬운 부분이 있지만 다음에 보완하겠습니다.', headline: '아쉬운 패배' },
  { coachComment: '실수를 줄이는 데 집중하겠습니다.', headline: '뼈아픈 패배' },
  { coachComment: '선수들의 멘탈 관리에 신경 쓰겠습니다.', headline: '다음을 기약하며' },
];

/**
 * 경기 후 코멘트 생성
 */
export async function generatePostMatchComment(context: {
  teamName: string;
  opponentName: string;
  isWin: boolean;
  scoreHome: number;
  scoreAway: number;
}): Promise<PostMatchComment> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const resultText = context.isWin ? '승리' : '패배';
      const prompt = `당신은 LoL e스포츠 기자입니다.
${context.teamName} vs ${context.opponentName} 경기 결과: ${context.scoreHome}:${context.scoreAway} (${context.teamName} ${resultText})

경기 후 코멘트를 생성하세요.
JSON 형식: {"coachComment": "감독 코멘트 (30자 이내)", "headline": "기사 헤드라인 (15자 이내)"}`;

      return await chatWithLlmJson<PostMatchComment>(prompt);
    } catch {
      // AI 실패 → 폴백
    }
  }

  const pool = context.isWin ? FALLBACK_WIN_COMMENTS : FALLBACK_LOSS_COMMENTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ─────────────────────────────────────────
// 이적 협상 AI 판단
// ─────────────────────────────────────────

export interface TransferDecision {
  accept: boolean;
  reason: string;
}

/**
 * AI 팀의 이적 제안 수락/거절 판단
 */
export async function evaluateTransferOffer(context: {
  playerName: string;
  playerOvr: number;
  playerAge: number;
  transferFee: number;
  offeredSalary: number;
  teamBudget: number;
  teamNeedPosition: boolean;
}): Promise<TransferDecision> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL e스포츠 팀의 GM입니다. 이적 제안을 평가하세요.

선수: ${context.playerName} (OVR ${context.playerOvr}, ${context.playerAge}세)
이적료: ${context.transferFee}만 원
제안 연봉: ${context.offeredSalary}만 원/년
팀 예산: ${context.teamBudget}만 원
해당 포지션 보강 필요: ${context.teamNeedPosition ? '예' : '아니오'}

JSON 형식: {"accept": true/false, "reason": "판단 이유 (30자 이내)"}`;

      return await chatWithLlmJson<TransferDecision>(prompt);
    } catch {
      // AI 실패 → 규칙 기반 폴백
    }
  }

  // 규칙 기반 폴백
  const valueRatio = context.transferFee / (context.playerOvr * 125);
  const canAfford = context.teamBudget >= context.transferFee;

  if (!canAfford) {
    return { accept: false, reason: '예산이 부족합니다.' };
  }

  if (valueRatio > 1.3) {
    return { accept: false, reason: '이적료가 시장 가치 대비 너무 높습니다.' };
  }

  if (context.teamNeedPosition && valueRatio <= 1.1) {
    return { accept: true, reason: '필요한 포지션이고 적정 가격입니다.' };
  }

  if (context.playerOvr >= 80 && context.playerAge <= 24) {
    return { accept: true, reason: '유망한 선수입니다.' };
  }

  return { accept: false, reason: '현재 보강 우선순위가 아닙니다.' };
}

// ─────────────────────────────────────────
// 선수 면담 AI 응답
// ─────────────────────────────────────────

import type { MeetingResponse, PressConferenceResponse } from './schemas/meeting';

/**
 * 선수 면담 AI 응답 생성
 */
export async function generateMeetingResponse(context: {
  teamName: string;
  playerName: string;
  playerPosition: string;
  playerMorale: number;
  topic: string;
}): Promise<MeetingResponse> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL e스포츠 팀 ${context.teamName}의 감독입니다.
선수 ${context.playerName} (${context.playerPosition})이 면담을 요청했습니다.
현재 사기: ${context.playerMorale}/100
면담 주제: ${context.topic}

감독으로서 응답하세요.
JSON 형식: {"dialogue": "감독의 대사 (50자 이내)", "loyaltyChange": -30~30, "moraleChange": -20~20, "approved": true/false, "reason": "판단 근거 (20자 이내)"}`;

      return await chatWithLlmJson<MeetingResponse>(prompt);
    } catch {
      // AI 실패 → 폴백
    }
  }

  // 폴백
  const fb = getFallbackMeetingResponse();
  return {
    dialogue: fb.dialogue,
    loyaltyChange: fb.loyaltyChange,
    moraleChange: Math.round(fb.loyaltyChange * 0.5),
    approved: fb.loyaltyChange >= 0,
    reason: '일반적 판단',
  };
}

// ─────────────────────────────────────────
// 기자회견 AI 응답
// ─────────────────────────────────────────

/**
 * 기자회견 AI 응답 생성
 */
export async function generatePressConferenceResponse(context: {
  teamName: string;
  recentResults: string;
  currentStanding?: string;
}): Promise<PressConferenceResponse> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      const prompt = `당신은 LoL e스포츠 팀 ${context.teamName}의 감독입니다.
기자회견에서 발언해야 합니다.
최근 성적: ${context.recentResults}
${context.currentStanding ? `현재 순위: ${context.currentStanding}` : ''}

기자회견 발언을 생성하세요.
JSON 형식: {"dialogue": "기자회견 발언 (80자 이내)", "teamMoraleEffect": -10~10, "publicOpinionChange": -15~15}`;

      return await chatWithLlmJson<PressConferenceResponse>(prompt);
    } catch {
      // AI 실패 → 폴백
    }
  }

  // 폴백
  const fb = getFallbackPressResponse();
  return {
    dialogue: fb,
    teamMoraleEffect: Math.floor(Math.random() * 7) - 2, // -2 ~ 4
    publicOpinionChange: Math.floor(Math.random() * 11) - 3, // -3 ~ 7
  };
}
