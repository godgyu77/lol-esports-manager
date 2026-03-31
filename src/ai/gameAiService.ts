/**
 * 게임 AI 서비스
 * - Ollama 사용 가능 시 LLM 호출
 * - 불가 시 템플릿 폴백 자동 전환
 * - 일간 이벤트, 경기 후 코멘트, 이적 협상 판단
 */

import { checkOllamaStatus, chatWithLlmJson } from './provider';
import { getFallbackMeetingResponse, getFallbackPressResponse } from './fallback';
import { useSettingsStore } from '../stores/settingsStore';
import {
  buildTeamContext,
  buildPlayerContext,
  buildMatchContext,
  buildTransferContext,
  resolveTeamId,
} from './contextBuilder';
import { augmentPromptWithKnowledge } from './rag/ragEngine';
import { nextRandom, pickRandom, randomInt } from '../utils/random';
import { fillTemplate } from '../utils/stringUtils';

// ─────────────────────────────────────────
// 상태 캐시
// ─────────────────────────────────────────

let _aiAvailable: boolean | null = null;

/** AI 사용 가능 여부 (캐시, 5분마다 재확인) */
let _lastCheck = 0;
let _lastAiEnabled: boolean | null = null;
const CHECK_INTERVAL = 5 * 60 * 1000;

export async function isAiAvailable(): Promise<boolean> {
  // 설정에서 AI 비활성화 시 즉시 false 반환
  const settings = useSettingsStore.getState();
  const { aiEnabled, aiProvider } = settings;
  if (!aiEnabled) return false;
  if (aiProvider === 'template') return false;

  if (aiProvider !== 'ollama') {
    const key = await settings.getApiKey();
    return Boolean(key);
  }

  // aiEnabled 상태가 변경되었으면 캐시 무효화
  if (_lastAiEnabled !== aiEnabled) {
    _aiAvailable = null;
    _lastAiEnabled = aiEnabled;
  }

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

interface DailyEventTemplate {
  type: DailyEvent['type'];
  category: string;
  title: string;
  description: string;
  effect?: DailyEvent['effect'];
}

const FALLBACK_EVENTS: readonly DailyEventTemplate[] = [
  // ── team_news (8) ──
  { type: 'team', category: 'team_news', title: '{teamName} 팀 분위기 최고조', description: '{teamName}의 라커룸 분위기가 매우 좋습니다. 선수들 간의 소통이 활발하고 시너지가 느껴집니다.', effect: { moraleChange: 3 } },
  { type: 'team', category: 'team_news', title: '{teamName} 팀 시설 업그레이드', description: '{teamName}이 트레이닝 시설을 최신 장비로 교체했습니다. 선수들의 훈련 효율이 향상될 것으로 기대됩니다.', effect: { statChange: { form: 2 } } },
  { type: 'team', category: 'team_news', title: '{teamName} 로스터 운영 논의', description: '{teamName} 코칭스태프가 선수 로테이션과 포지션 운영에 대한 내부 회의를 진행했습니다.', effect: { moraleChange: 0 } },
  { type: 'team', category: 'team_news', title: '{teamName} 팬미팅 개최', description: '{teamName}이 팬들과의 소통을 위한 온라인 팬미팅을 진행했습니다. 선수들의 팬 서비스가 좋은 반응을 얻었습니다.', effect: { moraleChange: 2 } },
  { type: 'team', category: 'team_news', title: '{teamName} 스크림 파트너 변경', description: '{teamName}이 새로운 스크림 파트너와 연습 경기를 시작했습니다. 다양한 전략을 시험해볼 좋은 기회입니다.', effect: { statChange: { form: 1 } } },
  { type: 'team', category: 'team_news', title: '{teamName} 전략 분석 보고서 공유', description: '코칭스태프가 다음 상대를 분석한 상세 전략 보고서를 선수들과 공유했습니다. 준비가 철저해지고 있습니다.', effect: { statChange: { form: 1 } } },
  { type: 'team', category: 'team_news', title: '{teamName} 유니폼 공개', description: '{teamName}이 새로운 시즌 유니폼을 공개했습니다. 팬들의 반응이 뜨겁습니다.', effect: { moraleChange: 1 } },
  { type: 'team', category: 'team_news', title: '{teamName} 미디어데이 참석', description: '{teamName} 선수들이 리그 공식 미디어데이에 참석했습니다. 인터뷰와 화보 촬영이 진행되었습니다.', effect: { moraleChange: 1 } },

  // ── morale (6) ──
  { type: 'morale', category: 'morale', title: '{teamName} 팀 빌딩 성공', description: '{teamName} 선수들이 함께 외부 활동을 즐기며 유대감을 쌓았습니다. 팀 내 분위기가 한층 좋아졌습니다.', effect: { moraleChange: 5 } },
  { type: 'morale', category: 'morale', title: '{teamName} 내부 갈등 발생', description: '{teamName}에서 선수 간 사소한 의견 충돌이 있었습니다. 빠른 중재가 필요해 보입니다.', effect: { moraleChange: -5 } },
  { type: 'morale', category: 'morale', title: '{teamName} 회식으로 사기 충전', description: '{teamName} 팀원들과 함께한 맛집 탐방이 사기를 높여주었습니다. 피로가 풀리는 시간이었습니다.', effect: { moraleChange: 4 } },
  { type: 'morale', category: 'morale', title: '{playerName}, 슬럼프 기미', description: '{playerName} 선수가 최근 훈련에서 평소와 다른 모습을 보이고 있습니다. 집중력이 떨어진 것 같습니다.', effect: { moraleChange: -3 } },
  { type: 'morale', category: 'morale', title: '{teamName} 승리 기념 파티', description: '최근 좋은 성적을 거둔 {teamName}이 팀 내 작은 축하 파티를 열었습니다. 선수들의 표정이 밝습니다.', effect: { moraleChange: 4 } },
  { type: 'morale', category: 'morale', title: '{teamName} 라커룸 긴장감 감지', description: '{teamName} 라커룸에서 미묘한 긴장감이 감지되고 있습니다. 감독의 세심한 관리가 필요한 시점입니다.', effect: { moraleChange: -2 } },

  // ── training (6) ──
  { type: 'team', category: 'training', title: '{playerName}, 돌파구 찾다', description: '{playerName} 선수가 오늘 훈련에서 눈에 띄는 성장을 보였습니다. 새로운 플레이를 시도하며 팀원들을 놀라게 했습니다.', effect: { statChange: { form: 3, morale: 2 } } },
  { type: 'team', category: 'training', title: '{teamName} 새 전략 시험 성공', description: '{teamName}이 스크림에서 새로운 전략을 시험하여 좋은 결과를 얻었습니다. 실전 적용을 검토 중입니다.', effect: { statChange: { form: 2 } } },
  { type: 'team', category: 'training', title: '{teamName} 부트캠프 효과 드러나', description: '{teamName}의 최근 집중 부트캠프 효과가 훈련 성과로 나타나고 있습니다. 팀 전체의 연습 강도가 올라갔습니다.', effect: { statChange: { form: 2 }, moraleChange: 1 } },
  { type: 'team', category: 'training', title: '{teamName} 연습 경기 호조', description: '오늘 진행된 스크림에서 {teamName}이 강팀을 상대로 인상적인 경기력을 보여주었습니다.', effect: { statChange: { form: 2 }, moraleChange: 2 } },
  { type: 'team', category: 'training', title: '{teamName} 전술 리뷰 세션', description: '{teamName} 코칭스태프가 최근 경기 VOD를 분석하며 개선점을 정리했습니다. 선수들도 적극 참여했습니다.', effect: { statChange: { form: 1 } } },
  { type: 'team', category: 'training', title: '{teamName} 체력 훈련 강화', description: '{teamName}이 장시간 경기 대비 체력 훈련 프로그램을 강화했습니다. 후반 집중력 향상이 기대됩니다.', effect: { statChange: { form: 1 }, moraleChange: -1 } },

  // ── individual (6) ──
  { type: 'player', category: 'individual', title: '{playerName}, 개인 연습에 몰두', description: '{playerName} 선수가 팀 연습 외 시간에도 솔로 큐를 돌며 개인기를 갈고 닦고 있습니다.', effect: { statChange: { form: 2 } } },
  { type: 'player', category: 'individual', title: '{playerName}, 솔로랭크 최고 기록 갱신', description: '{playerName} 선수가 솔로랭크에서 자신의 최고 기록을 경신했습니다. 자신감이 올라가고 있습니다.', effect: { statChange: { form: 2 }, moraleChange: 3 } },
  { type: 'player', category: 'individual', title: '{playerName} 건강검진 결과 양호', description: '{playerName} 선수의 정기 건강검진 결과가 양호하게 나왔습니다. 손목과 허리 상태 모두 문제 없습니다.', effect: { moraleChange: 1 } },
  { type: 'player', category: 'individual', title: '{playerName}, 미디어 인터뷰 화제', description: '{playerName} 선수의 최근 인터뷰가 팬들 사이에서 화제가 되고 있습니다. 솔직한 발언이 공감을 얻었습니다.', effect: { moraleChange: 2 } },
  { type: 'player', category: 'individual', title: '{playerName}, 생일 축하 이벤트', description: '오늘은 {playerName} 선수의 생일입니다! 팀원들이 깜짝 파티를 준비해 즐거운 시간을 보냈습니다.', effect: { moraleChange: 5 } },
  { type: 'player', category: 'individual', title: '{playerName}, 개인 스트리밍 인기', description: '{playerName} 선수의 개인 방송이 큰 인기를 끌고 있습니다. 팬들과의 소통이 활발해지고 있습니다.', effect: { moraleChange: 2 } },

  // ── league (4) ──
  { type: 'news', category: 'league', title: 'LCK 규정 변경 안내', description: '리그 사무국이 새로운 경기 규정을 발표했습니다. 전 팀에 해당되는 변경 사항이 있으니 확인이 필요합니다.', effect: { moraleChange: 0 } },
  { type: 'news', category: 'league', title: '리그 일정 조정 공지', description: '리그 사무국이 일부 경기 일정을 조정했습니다. 스케줄 재확인이 필요합니다.', effect: { moraleChange: 0 } },
  { type: 'news', category: 'league', title: '타 팀 로스터 변경 소식', description: '경쟁 팀에서 주전 선수 교체가 발표되었습니다. 앞으로의 매치업 분석에 변수가 생겼습니다.', effect: { moraleChange: 0 } },
  { type: 'news', category: 'league', title: 'LCK 올스타전 선정', description: 'LCK가 올스타 투표 결과를 발표했습니다. 리그 전체 분위기가 활기를 띠고 있습니다.', effect: { moraleChange: 1 } },
];

/**
 * 일간 랜덤 이벤트 생성 (20% 확률)
 */
export async function generateDailyEvent(context: {
  teamName: string;
  playerNames: string[];
  currentDate: string;
  recentResults?: string; // "3승 1패" 등
  teamId?: string;
}): Promise<DailyEvent | null> {
  // 20% 확률로 이벤트 발생
  if (nextRandom() > 0.2) return null;

  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      // 팀 ID 확보 → 풍부한 컨텍스트 수집
      const tid = context.teamId ?? (await resolveTeamId(context.teamName));
      const teamCtx = tid ? await buildTeamContext(tid) : '';

      const prompt = `당신은 LoL e스포츠 매니저 게임의 이벤트 생성기입니다.

[현재 팀 상태]
${teamCtx || `${context.teamName} 팀`}
날짜: ${context.currentDate}

위 상태를 반영하여 팀의 일상 이벤트를 하나 생성하세요.
부상자, 갈등, 최근 성적 등 현재 상황에 맞는 이벤트를 만드세요.

JSON 형식으로 응답하세요:
{"type": "news|team|player|injury|morale", "title": "이벤트 제목 (10자 이내)", "description": "이벤트 설명 (50자 이내)"}`;

      const augmented = await augmentPromptWithKnowledge(prompt, context.teamName);
      return await chatWithLlmJson<DailyEvent>(augmented);
    } catch {
      // AI 실패 → 폴백
    }
  }

  // 폴백: 랜덤 템플릿 + 팀/선수 이름 치환
  const template = pickRandom(FALLBACK_EVENTS);
  const playerName = context.playerNames.length > 0 ? pickRandom(context.playerNames) : '선수';
  const vars: Record<string, string> = {
    teamName: context.teamName,
    playerName,
  };

  return {
    type: template.type,
    title: fillTemplate(template.title, vars),
    description: fillTemplate(template.description, vars),
    effect: template.effect,
  };
}

// ─────────────────────────────────────────
// 경기 후 코멘트 생성
// ─────────────────────────────────────────

export interface PostMatchComment {
  coachComment: string;
  headline: string;
}

interface PostMatchTemplate {
  coachComment: string;
  headline: string;
}

// 압도적 승리 (score diff >= 2)
const FALLBACK_DOMINANT_WIN: readonly PostMatchTemplate[] = [
  { coachComment: '오늘 경기는 선수들이 완벽하게 준비한 결과입니다. {opponentName} 상대로 이 정도 퍼포먼스라면 자부심을 가질 만합니다.', headline: '{teamName}, {opponentName} 상대 압도적 승리' },
  { coachComment: '처음부터 끝까지 우리가 주도한 경기였습니다. {mvpName} 선수의 활약이 특히 돋보였습니다.', headline: '{teamName}, {opponentName} 완파' },
  { coachComment: '드래프트부터 마무리까지 전부 계획대로였습니다. 선수들에게 최고점을 주고 싶습니다.', headline: '{teamName}, 완벽한 경기 운영으로 대승' },
  { coachComment: '이런 경기가 바로 우리가 목표하는 경기입니다. {opponentName}을 상대로 자신감을 얻었습니다.', headline: '{teamName}, {opponentName}에 일방적 승리' },
  { coachComment: '모든 라인에서 우위를 점했습니다. 팀 전체의 시너지가 정점에 달한 느낌입니다.', headline: '{teamName}, 압도적 전력 차이 과시' },
];

// 접전 승리
const FALLBACK_CLOSE_WIN: readonly PostMatchTemplate[] = [
  { coachComment: '쉽지 않은 경기였지만, 중요한 순간에 선수들이 집중력을 발휘해주었습니다.', headline: '{teamName}, {opponentName} 상대 진땀 승리' },
  { coachComment: '{opponentName}이 강한 팀이라는 걸 다시 한번 느꼈습니다. 하지만 우리도 만만치 않다는 걸 보여줬죠.', headline: '{teamName}, 접전 끝에 승리 쟁취' },
  { coachComment: '마지막 팀파이트가 승부의 갈림길이었습니다. {mvpName} 선수의 판단이 결정적이었습니다.', headline: '{teamName}, 명승부 끝에 {opponentName} 제압' },
  { coachComment: '이기긴 했지만 아쉬운 부분이 많습니다. 중반 운영에서 더 좋은 선택을 할 수 있었어요.', headline: '{teamName}, 아슬아슬한 승리' },
  { coachComment: '팀워크가 빛난 경기였습니다. 어려운 상황에서도 포기하지 않는 정신력이 대단합니다.', headline: '{teamName}, {opponentName}과 혈전 끝에 승리' },
];

// 접전 패배
const FALLBACK_CLOSE_LOSS: readonly PostMatchTemplate[] = [
  { coachComment: '아쉬운 결과입니다. {opponentName}이 잘했지만, 우리도 충분히 이길 수 있었던 경기였습니다.', headline: '{teamName}, {opponentName}에 아쉬운 석패' },
  { coachComment: '한 끗 차이였습니다. 팀파이트에서의 실수를 반드시 교정하겠습니다.', headline: '{teamName}, 아쉬운 한 끗 차이 패배' },
  { coachComment: '경기 내용은 나쁘지 않았습니다. 결정적인 순간에 좀 더 냉정했어야 했는데, 아쉽습니다.', headline: '{teamName}, 끝내 역전 허용' },
  { coachComment: '선수들의 노력은 충분했습니다. 결과가 따라오지 않았을 뿐, 방향은 맞다고 생각합니다.', headline: '{teamName}, {opponentName}에 근소한 차이로 패배' },
  { coachComment: '오늘 패배를 발판 삼겠습니다. {opponentName}의 플레이에서 배울 점이 많았습니다.', headline: '{teamName}, 뼈아픈 석패... 다음을 기약' },
];

// 압도적 패배 (score diff >= 2)
const FALLBACK_DOMINANT_LOSS: readonly PostMatchTemplate[] = [
  { coachComment: '완벽하게 패배한 경기입니다. 변명의 여지가 없습니다. 처음부터 다시 준비하겠습니다.', headline: '{teamName}, {opponentName}에 완패' },
  { coachComment: '오늘은 {opponentName}이 모든 면에서 우리를 압도했습니다. 심각하게 돌아봐야 할 경기입니다.', headline: '{teamName}, 무기력한 패배' },
  { coachComment: '팬분들께 죄송합니다. 이런 경기력은 프로로서 용납할 수 없습니다. 반드시 바로잡겠습니다.', headline: '{teamName}, {opponentName} 상대 대패' },
  { coachComment: '드래프트부터 문제가 있었습니다. 전면적인 재검토가 필요합니다.', headline: '{teamName}, 속수무책 패배' },
  { coachComment: '선수들의 멘탈 관리가 가장 시급합니다. 패배에서 배우고 빠르게 회복하겠습니다.', headline: '{teamName}, 충격적 대패... 팬들 실망' },
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
  homeTeamId?: string;
  awayTeamId?: string;
  mvpName?: string;
  duration?: number;
}): Promise<PostMatchComment> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      // 경기 컨텍스트 수집
      const homeId = context.homeTeamId ?? (await resolveTeamId(context.teamName));
      const awayId = context.awayTeamId ?? (await resolveTeamId(context.opponentName));
      const matchCtx =
        homeId && awayId
          ? await buildMatchContext(homeId, awayId, {
              scoreHome: context.scoreHome,
              scoreAway: context.scoreAway,
              mvpName: context.mvpName,
              duration: context.duration,
            })
          : '';

      const resultText = context.isWin ? '승리' : '패배';
      const prompt = `당신은 LoL e스포츠 기자입니다.

[경기 정보]
${matchCtx || `${context.teamName} vs ${context.opponentName} ${context.scoreHome}:${context.scoreAway}`}
${context.teamName} ${resultText}

위 경기 정보를 바탕으로 경기 후 코멘트를 생성하세요.
매치업, 상대전적 등을 반영한 구체적인 코멘트를 만드세요.

JSON 형식: {"coachComment": "감독 코멘트 (30자 이내)", "headline": "기사 헤드라인 (15자 이내)"}`;

      const augmented = await augmentPromptWithKnowledge(prompt, `경기 결과 ${context.opponentName}`);
      return await chatWithLlmJson<PostMatchComment>(augmented);
    } catch {
      // AI 실패 → 폴백
    }
  }

  // 폴백: 점수 차이 기반 세분화
  const scoreDiff = Math.abs(context.scoreHome - context.scoreAway);
  const isDominant = scoreDiff >= 2;

  let pool: readonly PostMatchTemplate[];
  if (context.isWin) {
    pool = isDominant ? FALLBACK_DOMINANT_WIN : FALLBACK_CLOSE_WIN;
  } else {
    pool = isDominant ? FALLBACK_DOMINANT_LOSS : FALLBACK_CLOSE_LOSS;
  }

  const template = pickRandom(pool);
  const vars: Record<string, string> = {
    teamName: context.teamName,
    opponentName: context.opponentName,
    mvpName: context.mvpName ?? '우리 선수',
  };

  return {
    coachComment: fillTemplate(template.coachComment, vars),
    headline: fillTemplate(template.headline, vars),
  };
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
  teamId?: string;
  playerId?: string;
}): Promise<TransferDecision> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      // 이적 시장 컨텍스트 수집
      const transferCtx =
        context.teamId && context.playerId
          ? await buildTransferContext(context.teamId, context.playerId)
          : '';

      const prompt = `당신은 LoL e스포츠 팀의 GM입니다. 이적 제안을 평가하세요.

[이적 시장 상황]
${transferCtx}

[이적 제안]
선수: ${context.playerName} (OVR ${context.playerOvr}, ${context.playerAge}세)
이적료: ${context.transferFee}만 원
제안 연봉: ${context.offeredSalary}만 원/년
해당 포지션 보강 필요: ${context.teamNeedPosition ? '예' : '아니오'}

위 정보를 종합하여 이적 제안을 판단하세요.
팀의 재정 상황, 포지션 현황, 리그 평균 연봉 등을 고려하세요.

JSON 형식: {"accept": true/false, "reason": "판단 이유 (30자 이내)"}`;

      const augmented = await augmentPromptWithKnowledge(prompt, `${context.playerName} 이적`);
      return await chatWithLlmJson<TransferDecision>(augmented);
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
import { meetingResponseSchema, pressConferenceSchema } from './schemas/meeting';

/**
 * 선수 면담 AI 응답 생성
 */
export async function generateMeetingResponse(context: {
  teamName: string;
  playerName: string;
  playerPosition: string;
  playerMorale: number;
  topic: string;
  teamId?: string;
  playerId?: string;
}): Promise<MeetingResponse> {
  const aiReady = await isAiAvailable();
  console.log('[generateMeetingResponse] aiReady:', aiReady, 'topic:', context.topic);

  if (aiReady) {
    try {
      // 선수 + 팀 컨텍스트 수집
      const playerCtx = context.playerId ? await buildPlayerContext(context.playerId) : '';
      const tid = context.teamId ?? (await resolveTeamId(context.teamName));
      const teamCtx = tid ? await buildTeamContext(tid) : '';

      const prompt = `당신은 LoL e스포츠 팀 ${context.teamName}의 감독입니다.

[팀 상태]
${teamCtx}

[면담 선수]
${playerCtx || `${context.playerName} (${context.playerPosition}, 사기 ${context.playerMorale}/100)`}

면담 주제: ${context.topic}

선수의 성격, 만족도, 팀 상황을 고려하여 감독으로서 응답하세요.
JSON 형식: {"dialogue": "감독의 대사 (50자 이내)", "loyaltyChange": -30~30, "moraleChange": -20~20, "approved": true/false, "reason": "판단 근거 (20자 이내)"}`;

      const augmented = await augmentPromptWithKnowledge(prompt, context.topic);
      return await chatWithLlmJson<MeetingResponse>(augmented, { schema: meetingResponseSchema });
    } catch {
      // AI 실패 → 폴백
    }
  }

  // 폴백: 주제 기반 매칭
  const fb = getFallbackMeetingResponse(context.topic);
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
  teamId?: string;
  lastMatchHomeTeamId?: string;
  lastMatchAwayTeamId?: string;
  lastMatchResult?: { scoreHome: number; scoreAway: number; mvpName?: string };
}): Promise<PressConferenceResponse> {
  const aiReady = await isAiAvailable();

  if (aiReady) {
    try {
      // 팀 + 경기 컨텍스트 수집
      const tid = context.teamId ?? (await resolveTeamId(context.teamName));
      const teamCtx = tid ? await buildTeamContext(tid) : '';

      let matchCtx = '';
      if (context.lastMatchHomeTeamId && context.lastMatchAwayTeamId) {
        matchCtx = await buildMatchContext(
          context.lastMatchHomeTeamId,
          context.lastMatchAwayTeamId,
          context.lastMatchResult,
        );
      }

      const prompt = `당신은 LoL e스포츠 팀 ${context.teamName}의 감독입니다.

[팀 상태]
${teamCtx}
${matchCtx ? `\n[최근 경기]\n${matchCtx}` : ''}

기자회견에서 발언해야 합니다.
팀의 현재 상태, 부상자, 선수 불만, 최근 경기 등을 고려하여 현실적인 발언을 생성하세요.

JSON 형식: {"dialogue": "기자회견 발언 (80자 이내)", "teamMoraleEffect": -10~10, "publicOpinionChange": -15~15}`;

      const augmented = await augmentPromptWithKnowledge(prompt, `기자회견 ${context.teamName}`);
      return await chatWithLlmJson<PressConferenceResponse>(augmented, { schema: pressConferenceSchema });
    } catch {
      // AI 실패 → 폴백
    }
  }

  // 폴백: 최근 결과 반영
  const fb = getFallbackPressResponse({
    recentResults: context.recentResults,
    teamName: context.teamName,
  });
  return {
    dialogue: fb,
    teamMoraleEffect: randomInt(-2, 4),
    publicOpinionChange: randomInt(-3, 7),
  };
}
