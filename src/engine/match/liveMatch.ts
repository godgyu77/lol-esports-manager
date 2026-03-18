/**
 * 틱 기반 실시간 경기 엔진
 * - 매 틱(= 게임 내 1분)마다 상태 업데이트
 * - 특정 시점에 선택지(Decision) 삽입 → 일시정지 → 유저 선택 → 재개
 * - 감독 모드: 작전 지시 선택지
 * - 선수 모드: 개인 행동 선택지
 * - 중계 메시지 실시간 생성
 */

import { MATCH_CONSTANTS } from '../../data/systemPrompt';
import type { Position } from '../../types/game';
import type { MatchEvent, MatchEventType } from '../../types/match';
import type { Player } from '../../types/player';
import type { PlayStyle } from '../../types/team';
import {
  type Lineup,
  type MatchupResult,
  evaluateMatchup,
  calculatePlayerRating,
} from './teamRating';
import type { PlayerGameStatLine } from './matchSimulator';
import type { DraftState } from '../draft/draftEngine';
import { createRng } from '../../utils/rng';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 게임 진행 페이즈 */
export type GamePhase = 'loading' | 'laning' | 'mid_game' | 'late_game' | 'finished';

/** 선택지 옵션 */
export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  /** 선택 시 효과: 양수=유리, 음수=불리 */
  effect: {
    winRateMod: number;        // 승률 보정 (-0.1 ~ +0.1)
    goldMod: number;           // 골드 보정
    moraleMod: number;         // 사기 보정
    riskFactor: number;        // 위험도 (0~1, 높으면 성공 시 큰 효과 but 실패 시 역효과)
  };
}

/** 경기 중 선택지 이벤트 */
export interface Decision {
  id: string;
  tick: number;
  phase: GamePhase;
  situation: string;          // 상황 설명
  mode: 'manager' | 'player'; // 어떤 모드용 선택지인지
  options: DecisionOption[];
  selectedOptionId?: string;   // 유저가 선택한 옵션
  resolved: boolean;
}

/** 중계 메시지 */
export interface Commentary {
  tick: number;
  message: string;
  type: 'info' | 'kill' | 'objective' | 'teamfight' | 'decision' | 'highlight';
}

/** 실시간 게임 상태 */
export interface LiveGameState {
  /** 현재 틱 (= 게임 내 분) */
  currentTick: number;
  /** 최대 틱 (경기 시간) */
  maxTick: number;
  /** 현재 페이즈 */
  phase: GamePhase;

  /** 골드 */
  goldHome: number;
  goldAway: number;
  /** 킬 */
  killsHome: number;
  killsAway: number;
  /** 타워 */
  towersHome: number;
  towersAway: number;
  /** 드래곤 */
  dragonsHome: number;
  dragonsAway: number;
  /** 바론 */
  baronHome: boolean;
  baronAway: boolean;

  /** 현재 승률 (실시간 변동) */
  currentWinRate: number;

  /** 발생한 이벤트 */
  events: MatchEvent[];
  /** 중계 메시지 */
commentary: Commentary[];
  /** 대기 중인 선택지 (null이면 자동 진행) */
  pendingDecision: Decision | null;
  /** 완료된 선택지들 */
  resolvedDecisions: Decision[];

  /** 선수별 실시간 스탯 (홈) */
  playerStatsHome: LivePlayerStat[];
  /** 선수별 실시간 스탯 (어웨이) */
  playerStatsAway: LivePlayerStat[];

  /** 게임 종료 여부 */
  isFinished: boolean;
  /** 승리 팀 */
  winner?: 'home' | 'away';
}

/** 실시간 선수 스탯 (틱별 누적) */
export interface LivePlayerStat {
  playerId: string;
  position: Position;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
}

// ─────────────────────────────────────────
// 선택지 생성
// ─────────────────────────────────────────

/** 라인전 선택지 (감독 모드) */
function createLaningDecision_Manager(tick: number, situation: string): Decision {
  return {
    id: `dec_mgr_laning_${tick}`,
    tick,
    phase: 'laning',
    situation,
    mode: 'manager',
    options: [
      {
        id: 'aggressive_ward',
        label: '적극적 와딩',
        description: '공격적 시야 확보로 갱킹 루트를 차단합니다',
        effect: { winRateMod: 0.03, goldMod: 0, moraleMod: 1, riskFactor: 0.2 },
      },
      {
        id: 'lane_swap',
        label: '라인 스왑',
        description: '불리한 매치업을 피해 라인을 교체합니다',
        effect: { winRateMod: 0.02, goldMod: -100, moraleMod: 0, riskFactor: 0.4 },
      },
      {
        id: 'play_safe',
        label: '안전 운영',
        description: 'CS에 집중하며 안전하게 라인전을 진행합니다',
        effect: { winRateMod: 0.0, goldMod: 50, moraleMod: 0, riskFactor: 0.0 },
      },
    ],
    resolved: false,
  };
}

/** 라인전 선택지 (선수 모드) */
function createLaningDecision_Player(tick: number, situation: string, position: Position): Decision {
  return {
    id: `dec_plr_laning_${tick}`,
    tick,
    phase: 'laning',
    situation,
    mode: 'player',
    options: [
      {
        id: 'aggressive_trade',
        label: '공격적 트레이드',
        description: '상대에게 적극적으로 교전을 걸어 킬각을 노립니다',
        effect: { winRateMod: 0.04, goldMod: 0, moraleMod: 2, riskFactor: 0.5 },
      },
      {
        id: 'safe_cs',
        label: '안전한 CS',
        description: 'CS에만 집중하며 실수를 줄입니다',
        effect: { winRateMod: 0.01, goldMod: 100, moraleMod: 0, riskFactor: 0.0 },
      },
      {
        id: 'roam',
        label: '로밍',
        description: '라인을 밀고 다른 라인을 도우러 갑니다',
        effect: { winRateMod: 0.03, goldMod: -50, moraleMod: 1, riskFactor: 0.3 },
      },
    ],
    resolved: false,
  };
}

/** 중반 선택지 (감독 모드) */
function createMidGameDecision_Manager(tick: number, situation: string): Decision {
  return {
    id: `dec_mgr_mid_${tick}`,
    tick,
    phase: 'mid_game',
    situation,
    mode: 'manager',
    options: [
      {
        id: 'contest_dragon',
        label: '드래곤 컨테스트',
        description: '드래곤 교전에 전원 투입합니다',
        effect: { winRateMod: 0.05, goldMod: 0, moraleMod: 3, riskFactor: 0.4 },
      },
      {
        id: 'trade_herald',
        label: '헤럴드 교환',
        description: '드래곤을 내주고 반대편에서 헤럴드를 확보합니다',
        effect: { winRateMod: 0.02, goldMod: 200, moraleMod: 0, riskFactor: 0.1 },
      },
      {
        id: 'split_pressure',
        label: '스플릿 압박',
        description: '사이드 라인 압박으로 맵 주도권을 가져옵니다',
        effect: { winRateMod: 0.03, goldMod: 150, moraleMod: 1, riskFactor: 0.2 },
      },
    ],
    resolved: false,
  };
}

/** 중반 선택지 (선수 모드) */
function createMidGameDecision_Player(tick: number, situation: string): Decision {
  return {
    id: `dec_plr_mid_${tick}`,
    tick,
    phase: 'mid_game',
    situation,
    mode: 'player',
    options: [
      {
        id: 'teamfight_engage',
        label: '교전 참여',
        description: '팀 교전에 적극적으로 참여합니다',
        effect: { winRateMod: 0.04, goldMod: 0, moraleMod: 2, riskFactor: 0.4 },
      },
      {
        id: 'side_farm',
        label: '사이드 파밍',
        description: 'CS를 챙기며 아이템을 완성합니다',
        effect: { winRateMod: 0.01, goldMod: 200, moraleMod: -1, riskFactor: 0.1 },
      },
      {
        id: 'vision_play',
        label: '시야 플레이',
        description: '핵심 구역의 시야를 확보합니다',
        effect: { winRateMod: 0.02, goldMod: 0, moraleMod: 0, riskFactor: 0.0 },
      },
    ],
    resolved: false,
  };
}

/** 후반 선택지 (감독 모드) */
function createLateGameDecision_Manager(tick: number, situation: string): Decision {
  return {
    id: `dec_mgr_late_${tick}`,
    tick,
    phase: 'late_game',
    situation,
    mode: 'manager',
    options: [
      {
        id: 'baron_call',
        label: '바론 콜',
        description: '바론 내셔를 공격합니다. 성공하면 큰 이득!',
        effect: { winRateMod: 0.08, goldMod: 0, moraleMod: 5, riskFactor: 0.5 },
      },
      {
        id: 'siege',
        label: '시즈',
        description: '안전하게 타워를 밀어 시야와 맵을 확보합니다',
        effect: { winRateMod: 0.03, goldMod: 300, moraleMod: 1, riskFactor: 0.1 },
      },
      {
        id: 'pick_comp',
        label: '픽 플레이',
        description: '적 캐릭터를 잡고 수적 우위로 오브젝트를 가져갑니다',
        effect: { winRateMod: 0.05, goldMod: 0, moraleMod: 3, riskFactor: 0.35 },
      },
    ],
    resolved: false,
  };
}

/** 후반 선택지 (선수 모드) */
function createLateGameDecision_Player(tick: number, situation: string): Decision {
  return {
    id: `dec_plr_late_${tick}`,
    tick,
    phase: 'late_game',
    situation,
    mode: 'player',
    options: [
      {
        id: 'flash_engage',
        label: '플래시 인게이지',
        description: '플래시를 사용해 과감하게 이니시에이팅합니다',
        effect: { winRateMod: 0.08, goldMod: 0, moraleMod: 5, riskFactor: 0.6 },
      },
      {
        id: 'peel_carry',
        label: '캐리 보호',
        description: '아군 캐리를 보호하며 안정적으로 딜링합니다',
        effect: { winRateMod: 0.03, goldMod: 0, moraleMod: 1, riskFactor: 0.1 },
      },
      {
        id: 'flank',
        label: '측면 우회',
        description: '적 후방으로 돌아가 백라인을 급습합니다',
        effect: { winRateMod: 0.06, goldMod: 0, moraleMod: 3, riskFactor: 0.45 },
      },
    ],
    resolved: false,
  };
}

// ─────────────────────────────────────────
// 개별 선수 지시 타입
// ─────────────────────────────────────────

export type PlayerInstructionType = 'aggressive' | 'safe' | 'roam' | 'lane_focus';

export interface PlayerInstruction {
  playerId: string;
  instruction: PlayerInstructionType;
}

export const PLAYER_INSTRUCTION_LABELS: Record<PlayerInstructionType, string> = {
  aggressive: '공격적으로 플레이',
  safe: '안전하게 플레이',
  roam: '적극적 로밍',
  lane_focus: '라인에 집중',
};

export const PLAYER_INSTRUCTION_DESCRIPTIONS: Record<PlayerInstructionType, string> = {
  aggressive: 'aggression 임시 +10 보정',
  safe: 'consistency 임시 +10 보정',
  roam: 'teamwork 임시 +5 보정 (정글/서포트)',
  lane_focus: 'laning 임시 +10 보정',
};

// ─────────────────────────────────────────
// 경기 중 전술 타입
// ─────────────────────────────────────────

/** 경기 중 플레이 스타일 */
export type InGamePlayStyle = 'aggressive' | 'controlled' | 'split';

/** 오브젝트 우선순위 */
export type ObjectivePriority = 'dragon' | 'baron' | 'balanced';

/** 팀파이트 성향 */
export type TeamfightAggression = 'engage' | 'avoid' | 'situational';

/** 경기 중 전술 설정 */
export interface InGameTactics {
  playStyle: InGamePlayStyle;
  objectivePriority: ObjectivePriority;
  teamfightAggression: TeamfightAggression;
}

// ─────────────────────────────────────────
// 밴픽 숙련도 보정
// ─────────────────────────────────────────

/**
 * 드래프트 픽 결과에서 각 선수의 챔피언 숙련도를 확인하여
 * 팀 전력 보정값을 계산한다.
 * - 숙련도 80 이상: +2% (=+1.0)
 * - 숙련도 60~79: 0% (보정 없음)
 * - 숙련도 60 미만: -2% (=-1.0)
 * 5명의 보정을 합산한 뒤 평균하여 팀 전력에 반영한다.
 */
function calculateDraftProficiencyBonus(
  teamDraft: { picks: { championId: string; position: Position }[] },
  lineup: Lineup,
): number {
  if (teamDraft.picks.length === 0) return 0;

  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  let totalBonus = 0;

  for (const pick of teamDraft.picks) {
    // 픽에 지정된 포지션의 선수 찾기
    const pos = pick.position;
    if (!positions.includes(pos)) continue;

    const player = lineup[pos];
    if (!player) continue;

    // 해당 선수의 챔피언 숙련도 조회
    const cp = player.championPool.find((c) => c.championId === pick.championId);
    const proficiency = cp?.proficiency ?? 40; // 풀에 없으면 낮은 숙련도

    if (proficiency >= 80) {
      totalBonus += 1.0;  // +2% 보정 (100점 스케일 기준 +1.0)
    } else if (proficiency < 60) {
      totalBonus -= 1.0;  // -2% 보정
    }
    // 60~79: 보정 없음
  }

  // 5명 평균
  return totalBonus / Math.max(teamDraft.picks.length, 1);
}

// ─────────────────────────────────────────
// 중계 텍스트 템플릿
// ─────────────────────────────────────────

const COMMENTARY_TEMPLATES = {
  gameStart: [
    '경기가 시작됩니다!',
    '양 팀 선수들이 소환사의 협곡에 입장합니다!',
    '드디어 경기 시작! 양 팀의 대결이 펼쳐집니다!',
    '소환사의 협곡에 전운이 감돕니다. 경기 시작!',
  ],
  midGameTransition: [
    '라인전이 종료되고 중반으로 넘어갑니다',
    '라인전 페이즈가 끝났습니다. 이제 팀 운영이 중요해집니다',
    '중반 진입! 오브젝트 싸움이 본격적으로 시작됩니다',
    '라인전이 마무리되며 본격적인 팀 교전 페이즈로 전환됩니다',
  ],
  lateGameTransition: [
    '후반 진입 — 바론과 엘더 드래곤이 중요해집니다',
    '후반 교전 페이즈! 한 번의 실수가 경기를 결정할 수 있습니다',
    '게임이 후반으로 접어듭니다. 바론 내셔가 핵심이 됩니다',
    '후반 진입! 이제 한타 한 번에 게임이 뒤집힐 수 있습니다',
  ],
  soloKill: [
    '{side}팀 선수의 솔로킬! 라인전에서 압도합니다!',
    '솔로킬! {side}팀이 라인전에서 우위를 점합니다!',
    '{side}팀의 화려한 솔로킬! 상대를 제압합니다!',
    '아! {side}팀 선수가 솔로킬을 따냅니다!',
    '{side}팀, 완벽한 콤보로 솔로킬 성공!',
    '기가 막힌 솔로킬! {side}팀이 라인전 주도권을 잡습니다!',
  ],
  counterKill: [
    '{side}팀의 반격 솔로킬!',
    '{side}팀이 반격에 성공합니다! 되받아치는 솔로킬!',
    '역전 솔로킬! {side}팀이 반격합니다!',
  ],
  gank: [
    '{side}팀 정글러의 갱킹!',
    '{side}팀 정글러의 기습 갱킹! 킬을 따냅니다!',
    '완벽한 갱킹 타이밍! {side}팀 정글러가 킬을 가져갑니다!',
    '{side}팀 정글러의 갱킹 성공! 라인을 장악합니다!',
    '갱킹! {side}팀의 정글러가 적을 급습합니다!',
    '{side}팀, 갱킹으로 킬을 추가합니다!',
  ],
  dragon: [
    '{side}팀이 드래곤을 확보합니다!',
    '드래곤 처치! {side}팀의 오브젝트 컨트롤이 돋보입니다!',
    '{side}팀, 깔끔하게 드래곤을 가져갑니다!',
    '드래곤 타이밍! {side}팀이 정확하게 오브젝트를 챙깁니다!',
    '{side}팀이 드래곤을 확보하며 우위를 점합니다!',
  ],
  dragonFight: [
    '드래곤 교전에서 {kills}킬!',
    '드래곤 앞 교전! {kills}킬을 따내며 {side}팀이 승리!',
    '드래곤 교전 발생! {side}팀이 {kills}킬을 기록합니다!',
    '드래곤을 둘러싼 교전! {kills}킬!',
  ],
  baron: [
    '{side}팀 바론 내셔 처치!',
    '내셔 남작 처치! {side}팀의 대역전극이 시작됩니다!',
    '{side}팀, 바론을 가져가며 게임의 주도권을 잡습니다!',
    '결정적인 바론! {side}팀이 이 게임을 끝낼 수 있을까?',
    '{side}팀, 바론 버프를 얻어 최종 공세를 준비합니다!',
  ],
  baronFight: [
    '바론 앞 대규모 교전! {kills}킬!',
    '바론 교전! {side}팀이 {kills}킬을 따내며 바론까지!',
    '바론 앞에서 대규모 한타! {kills}킬이 터졌습니다!',
    '치열한 바론 교전! {side}팀이 {kills}킬로 승리합니다!',
  ],
  midSkirmish: [
    '{side}팀이 중반 교전에서 킬을 추가합니다',
    '소규모 교전 발생! {side}팀이 킬을 가져갑니다',
    '{side}팀, 교전에서 승리하며 골드 격차를 벌립니다',
  ],
  lateTeamfight: [
    '한타 발생! {side}팀 {kills}킬!',
    '대규모 교전! {side}팀이 {kills}킬을 따내며 승리!',
    '에이스급 한타! {side}팀이 {kills}킬로 전세를 뒤집습니다!',
    '아름다운 한타! {side}팀의 팀파이트 실력이 빛납니다! {kills}킬!',
    '{side}팀의 인게이지가 완벽했습니다! {kills}명을 처치!',
    '후반 대규모 교전에서 {side}팀이 {kills}킬을 기록합니다!',
  ],
  nexusDestroy: [
    '{side}팀이 넥서스를 파괴합니다! GG!',
    '{side}팀 승리! 넥서스가 무너집니다!',
    'GG! {side}팀이 넥서스를 부수며 승리를 확정합니다!',
    '{side}팀의 승리! 경기 종료!',
    '넥서스 파괴! {side}팀이 이 경기의 승자입니다!',
  ],
};

function pickCommentary(pool: string[], vars: Record<string, string> = {}): string {
  let text = pool[Math.floor(Math.random() * pool.length)];
  for (const [key, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${key}}`, value);
  }
  return text;
}

function sideLabel(side: 'home' | 'away'): string {
  return side === 'home' ? '블루' : '레드';
}

// ─────────────────────────────────────────
// 라이브 경기 엔진
// ─────────────────────────────────────────

/**
 * 라이브 경기 인스턴스 생성
 * 틱별로 advance() 호출하여 진행
 */
export class LiveMatchEngine {
  private state: LiveGameState;
  private matchup: MatchupResult;
  private rand: () => number;
  private gameMode: 'manager' | 'player';
  private userPosition?: Position; // 선수 모드일 때 유저 포지션
  private homeLineup: Lineup;
  private awayLineup: Lineup;
  private homePlayStyle: PlayStyle;
  private awayPlayStyle: PlayStyle;

  // 개별 선수 지시 (최대 2명)
  private playerInstructions: Map<string, PlayerInstructionType> = new Map();

  // 경기 중 전술 (유저 팀)
  private inGameTactics: InGameTactics = {
    playStyle: 'controlled',
    objectivePriority: 'balanced',
    teamfightAggression: 'situational',
  };
  private tacticsCooldown: number = 0; // 남은 쿨다운 틱

  // 선택지 발생 틱 (고정 시점)
  private decisionTicks = {
    laning: [5, 10],         // 5분, 10분
    midGame: [18, 22],       // 18분, 22분
    lateGame: [28, 33],      // 28분, 33분
  };

  constructor(params: {
    homeLineup: Lineup;
    awayLineup: Lineup;
    homeTraits?: Record<string, string[]>;
    awayTraits?: Record<string, string[]>;
    homeForm?: Record<string, number>;
    awayForm?: Record<string, number>;
    seed: string;
    gameMode: 'manager' | 'player';
    userPosition?: Position;
    durationMinutes?: number;
    draftResult?: DraftState | null;
    homePlayStyle?: PlayStyle;
    awayPlayStyle?: PlayStyle;
  }) {
    this.homeLineup = params.homeLineup;
    this.awayLineup = params.awayLineup;
    this.homePlayStyle = params.homePlayStyle ?? 'controlled';
    this.awayPlayStyle = params.awayPlayStyle ?? 'controlled';

    this.matchup = evaluateMatchup(
      params.homeLineup,
      params.awayLineup,
      params.homeTraits ?? {},
      params.awayTraits ?? {},
      params.homeForm ?? {},
      params.awayForm ?? {},
      this.homePlayStyle,
      this.awayPlayStyle,
    );

    // 밴픽 결과 → 챔피언 숙련도 보정
    if (params.draftResult) {
      const homeBonus = calculateDraftProficiencyBonus(
        params.draftResult.blue, params.homeLineup,
      );
      const awayBonus = calculateDraftProficiencyBonus(
        params.draftResult.red, params.awayLineup,
      );
      this.matchup.homeRating.overall += homeBonus;
      this.matchup.awayRating.overall += awayBonus;
    }
    this.rand = createRng(params.seed);
    this.gameMode = params.gameMode;
    this.userPosition = params.userPosition;

    // 경기 시간 결정
    const ratingDiff = Math.abs(this.matchup.homeRating.overall - this.matchup.awayRating.overall);
    const baseDuration = params.durationMinutes ?? Math.round(
      MATCH_CONSTANTS.gameDuration.max - ratingDiff * 0.3 + (this.rand() - 0.5) * 10,
    );
    const maxTick = Math.max(MATCH_CONSTANTS.gameDuration.min,
      Math.min(MATCH_CONSTANTS.gameDuration.max, baseDuration));

    const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

    this.state = {
      currentTick: 0,
      maxTick,
      phase: 'loading',
      goldHome: 0,
      goldAway: 0,
      killsHome: 0,
      killsAway: 0,
      towersHome: 0,
      towersAway: 0,
      dragonsHome: 0,
      dragonsAway: 0,
      baronHome: false,
      baronAway: false,
      currentWinRate: this.matchup.homeWinRate,
      events: [],
      commentary: [],
      pendingDecision: null,
      resolvedDecisions: [],
      playerStatsHome: positions.map(pos => ({
        playerId: params.homeLineup[pos].id,
        position: pos,
        kills: 0, deaths: 0, assists: 0, cs: 0,
      })),
      playerStatsAway: positions.map(pos => ({
        playerId: params.awayLineup[pos].id,
        position: pos,
        kills: 0, deaths: 0, assists: 0, cs: 0,
      })),
      isFinished: false,
    };
  }

  /** 현재 상태 조회 (읽기 전용) */
  getState(): Readonly<LiveGameState> {
    return this.state;
  }

  /** 현재 경기 중 전술 조회 */
  getInGameTactics(): Readonly<InGameTactics> {
    return this.inGameTactics;
  }

  /** 전술 쿨다운 남은 틱 조회 */
  getTacticsCooldown(): number {
    return this.tacticsCooldown;
  }

  /**
   * 개별 선수 지시 설정
   * 한 번에 최대 2명에게만 지시 가능
   * 이미 지시가 있는 선수는 교체됨
   * @returns 성공 여부
   */
  setPlayerInstruction(playerId: string, instruction: PlayerInstructionType): boolean {
    // 이미 해당 선수에게 지시가 있으면 교체
    if (this.playerInstructions.has(playerId)) {
      this.playerInstructions.set(playerId, instruction);
      this.addCommentary(
        this.state.currentTick,
        `선수 지시 변경: ${PLAYER_INSTRUCTION_LABELS[instruction]}`,
        'info',
      );
      return true;
    }

    // 최대 2명 제한
    if (this.playerInstructions.size >= 2) {
      return false;
    }

    this.playerInstructions.set(playerId, instruction);
    this.addCommentary(
      this.state.currentTick,
      `선수 지시: ${PLAYER_INSTRUCTION_LABELS[instruction]}`,
      'info',
    );
    return true;
  }

  /** 선수 지시 해제 */
  clearPlayerInstruction(playerId: string): void {
    this.playerInstructions.delete(playerId);
  }

  /** 현재 선수 지시 조회 */
  getPlayerInstructions(): ReadonlyMap<string, PlayerInstructionType> {
    return this.playerInstructions;
  }

  /**
   * 경기 중 전술 변경
   * 쿨다운(5틱) 동안 재변경 불가
   */
  setInGameTactics(
    style: InGamePlayStyle,
    objectivePriority: ObjectivePriority,
    teamfightAggression: TeamfightAggression,
  ): boolean {
    if (this.tacticsCooldown > 0) return false;

    this.inGameTactics = { playStyle: style, objectivePriority, teamfightAggression };
    this.tacticsCooldown = 5; // 5틱 쿨다운

    this.addCommentary(
      this.state.currentTick,
      `전술 변경: ${style === 'aggressive' ? '공격적' : style === 'split' ? '스플릿' : '안정'} / ${objectivePriority === 'dragon' ? '드래곤 중시' : objectivePriority === 'baron' ? '바론 중시' : '균형'} / ${teamfightAggression === 'engage' ? '적극 교전' : teamfightAggression === 'avoid' ? '교전 회피' : '상황 판단'}`,
      'info',
    );

    return true;
  }

  /** 선수 스탯을 PlayerGameStatLine 형식으로 변환 (GameResult 생성용) */
  getPlayerStatLines(): { home: PlayerGameStatLine[]; away: PlayerGameStatLine[] } {
    const convert = (stats: LivePlayerStat[], lineup: Lineup): PlayerGameStatLine[] =>
      stats.map(s => {
        const player = lineup[s.position];
        const killGold = s.kills * 300;
        const csGold = s.cs * 20;
        const baseGold = this.state.maxTick * 100;
        return {
          playerId: s.playerId,
          position: s.position,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          cs: s.cs,
          goldEarned: killGold + csGold + baseGold,
          damageDealt: Math.round(
            this.state.maxTick * 600 *
            ({ top: 0.18, jungle: 0.15, mid: 0.25, adc: 0.30, support: 0.12 }[s.position] / 0.2) *
            (1 + (player.stats.mechanical - 60) * 0.005),
          ),
        };
      });
    return {
      home: convert(this.state.playerStatsHome, this.homeLineup),
      away: convert(this.state.playerStatsAway, this.awayLineup),
    };
  }

  /** 선택지 응답 */
  resolveDecision(optionId: string): void {
    const decision = this.state.pendingDecision;
    if (!decision) return;

    const option = decision.options.find(o => o.id === optionId);
    if (!option) return;

    decision.selectedOptionId = optionId;
    decision.resolved = true;

    // 선택지 효과 적용
    const risk = this.rand();
    const success = risk > option.effect.riskFactor;

    if (success) {
      this.state.currentWinRate = Math.max(0.15, Math.min(0.85,
        this.state.currentWinRate + option.effect.winRateMod));
      this.state.goldHome += option.effect.goldMod;
      this.addCommentary(decision.tick, `✓ "${option.label}" 선택 — 성공!`, 'decision');
    } else {
      // 실패 시 역효과
      this.state.currentWinRate = Math.max(0.15, Math.min(0.85,
        this.state.currentWinRate - option.effect.winRateMod * 0.5));
      this.state.goldAway += Math.abs(option.effect.goldMod);
      this.addCommentary(decision.tick, `✗ "${option.label}" 선택 — 실패...`, 'decision');
    }

    this.state.resolvedDecisions.push(decision);
    this.state.pendingDecision = null;
  }

  /**
   * 1틱 진행
   * @returns 선택지가 발생하면 true (일시정지 필요)
   */
  advance(): boolean {
    if (this.state.isFinished) return false;
    if (this.state.pendingDecision) return true; // 선택지 대기 중

    this.state.currentTick++;
    const tick = this.state.currentTick;

    // 전술 쿨다운 감소
    if (this.tacticsCooldown > 0) this.tacticsCooldown--;

    // 페이즈 업데이트
    if (tick <= 1) {
      this.state.phase = 'laning';
      this.addCommentary(0, pickCommentary(COMMENTARY_TEMPLATES.gameStart), 'info');
    } else if (tick === MATCH_CONSTANTS.laningPhaseEnd + 1) {
      this.state.phase = 'mid_game';
      this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.midGameTransition), 'info');
    } else if (tick === 25) {
      this.state.phase = 'late_game';
      this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.lateGameTransition), 'info');
    }

    // 경기 종료 체크
    if (tick >= this.state.maxTick) {
      this.finishGame();
      return false;
    }

    // ── 틱별 이벤트 처리 ──
    this.processTickEvents(tick);

    // ── 선택지 체크 ──
    const decision = this.checkDecision(tick);
    if (decision) {
      this.state.pendingDecision = decision;
      return true; // 일시정지
    }

    return false;
  }

  /** 남은 틱을 모두 진행 (자동 시뮬용 — 선택지는 첫 번째 옵션으로 자동 선택) */
  simulateToEnd(): void {
    while (!this.state.isFinished) {
      const paused = this.advance();
      if (paused && this.state.pendingDecision) {
        // 자동: 첫 번째 옵션 선택
        this.resolveDecision(this.state.pendingDecision.options[0].id);
      }
    }
  }

  // ─────────────────────────────────────────
  // 내부 로직
  // ─────────────────────────────────────────

  private processTickEvents(tick: number): void {
    const { matchup } = this;
    const wr = this.state.currentWinRate;

    // 전술 보정 계수
    const tactics = this.inGameTactics;
    const killMod = tactics.playStyle === 'aggressive' ? 1.20 : 1.0;   // aggressive: 킬 확률 +20%
    const deathMod = tactics.playStyle === 'aggressive' ? 1.15 : 1.0;  // aggressive: 데스 확률 +15%
    const dragonMod = tactics.objectivePriority === 'dragon' ? 1.30 : 1.0; // 드래곤 중시: +30%
    const teamfightMod = tactics.teamfightAggression === 'engage' ? 1.25 : 1.0; // 적극 교전: +25%

    // 매 3틱(3분)마다 CS 누적
    if (tick % 3 === 0) {
      const csPerMin: Record<Position, number> = { top: 8, jungle: 5.5, mid: 8.5, adc: 9, support: 1.5 };
      const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
      for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const base = Math.round(csPerMin[pos] * 3 + (this.rand() - 0.5) * 4);
        this.state.playerStatsHome[i].cs += Math.max(0, base);
        this.state.playerStatsAway[i].cs += Math.max(0, base + Math.round((this.rand() - 0.5) * 4));
      }
    }

    // ── 라인전 (1~15분) ──
    if (tick <= 15) {
      // 매 3분마다 CS 골드 차이 업데이트
      if (tick % 3 === 0) {
        const laningDiff = matchup.homeRating.laningPower - matchup.awayRating.laningPower;
        const csGold = Math.round(laningDiff * 5 + (this.rand() - 0.5) * 100);
        if (csGold > 0) this.state.goldHome += csGold;
        else this.state.goldAway += Math.abs(csGold);
      }

      // 솔로킬 (5분부터, ~15% 확률/분) — aggressive 전술 시 확률 증가
      if (tick >= 5 && this.rand() < 0.08 * killMod) {
        const killer = this.rand() < wr ? 'home' : 'away';
        this.registerKill(tick, killer, '라인전 솔로킬');
        // aggressive 전술 시 상대 킬도 추가 확률
        if (deathMod > 1.0 && this.rand() < 0.08 * (deathMod - 1.0)) {
          const otherSide = killer === 'home' ? 'away' : 'home';
          this.registerKill(tick, otherSide, '반격 솔로킬');
        }
      }

      // 갱킹 (4분부터, ~10% 확률/분)
      if (tick >= 4 && this.rand() < 0.06) {
        const jglDiff = matchup.laneMatchups.jungle;
        const success = this.rand() < 0.5 + jglDiff * 0.01;
        const ganker = (jglDiff > 0 && success) ? 'home' : 'away';
        this.registerKill(tick, ganker, '정글 갱킹');
        this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.gank, { side: sideLabel(ganker) }), 'kill');
      }
    }

    // ── 중반 (16~24분) ──
    if (tick > 15 && tick <= 24) {
      // 드래곤 (18, 22분) — 드래곤 중시 전술 시 교전 확률 증가
      if (tick === 18 || tick === 22) {
        const tfDiff = matchup.homeRating.teamfightPower - matchup.awayRating.teamfightPower;
        const dragonBonus = dragonMod > 1.0 ? 0.1 : 0; // 드래곤 중시 시 홈팀 유리
        const dragonWin = this.rand() < 0.5 + tfDiff * 0.008 + (wr - 0.5) * 0.2 + dragonBonus;
        const side = dragonWin ? 'home' : 'away';

        if (side === 'home') this.state.dragonsHome++;
        else this.state.dragonsAway++;

        this.addEvent(tick, 'dragon', side, '드래곤 처치', 200);
        this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.dragon, { side: sideLabel(side) }), 'objective');

        // 드래곤 교전 킬 — 드래곤 중시 시 교전 확률 증가
        if (this.rand() < 0.5 * dragonMod) {
          const kills = 1 + Math.floor(this.rand() * 2);
          for (let k = 0; k < kills; k++) this.registerKill(tick, side, '드래곤 교전');
          this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.dragonFight, { kills: String(kills), side: sideLabel(side) }), 'teamfight');
        }
      }

      // 타워 (매 4분마다 확인)
      if (tick % 4 === 0) {
        const leading = this.state.goldHome > this.state.goldAway ? 'home' : 'away';
        if (this.rand() < 0.4) {
          if (leading === 'home') this.state.towersHome++;
          else this.state.towersAway++;
          this.addEvent(tick, 'tower_destroy', leading, '타워 파괴', 550);
        }
      }

      // 소규모 교전 — 적극 교전 전술 시 확률 증가
      if (this.rand() < 0.05 * teamfightMod) {
        const winner = this.rand() < wr ? 'home' : 'away';
        this.registerKill(tick, winner, '중반 교전');
      }
    }

    // ── 후반 (25분+) ──
    if (tick >= 25) {
      // 바론 (28분, 33분)
      if (tick === 28 || tick === 33) {
        const baronWin = this.rand() < wr;
        const side = baronWin ? 'home' : 'away';

        if (side === 'home') this.state.baronHome = true;
        else this.state.baronAway = true;

        this.addEvent(tick, 'baron', side, '바론 내셔 처치', 1500);
        this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.baron, { side: sideLabel(side) }), 'objective');

        // 바론 교전
        if (this.rand() < 0.6) {
          const kills = 2 + Math.floor(this.rand() * 3);
          for (let k = 0; k < kills; k++) this.registerKill(tick, side, '바론 교전');
          this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.baronFight, { kills: String(kills), side: sideLabel(side) }), 'teamfight');
        }
      }

      // 타워 파괴 (바론 후)
      if ((this.state.baronHome || this.state.baronAway) && this.rand() < 0.3) {
        const side = this.state.baronHome ? 'home' : 'away';
        if (side === 'home') this.state.towersHome++;
        else this.state.towersAway++;
        this.addEvent(tick, 'tower_destroy', side, '내부 타워 파괴', 550);
      }

      // 후반 교전 — 적극 교전 전술 시 확률 증가
      if (this.rand() < 0.08 * teamfightMod) {
        const winner = this.rand() < wr ? 'home' : 'away';
        const kills = 1 + Math.floor(this.rand() * 2);
        for (let k = 0; k < kills; k++) this.registerKill(tick, winner, '후반 교전');
        this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.lateTeamfight, { side: sideLabel(winner), kills: String(kills) }), 'teamfight');
      }
    }
  }

  private checkDecision(tick: number): Decision | null {
    const { decisionTicks: dt } = this;
    const mode = this.gameMode;

    // 라인전 선택지
    if (dt.laning.includes(tick)) {
      const situation = tick === 5
        ? '라인전 초반, 상대 정글러의 동선이 보입니다'
        : '라인전 중반, 상대와의 CS 차이가 벌어지고 있습니다';

      return mode === 'manager'
        ? createLaningDecision_Manager(tick, situation)
        : createLaningDecision_Player(tick, situation, this.userPosition ?? 'mid');
    }

    // 중반 선택지
    if (dt.midGame.includes(tick)) {
      const situation = tick === 18
        ? '첫 번째 드래곤이 스폰됩니다. 어떻게 대응할까요?'
        : '두 번째 드래곤 스폰 — 상대팀이 시야를 깔고 있습니다';

      return mode === 'manager'
        ? createMidGameDecision_Manager(tick, situation)
        : createMidGameDecision_Player(tick, situation);
    }

    // 후반 선택지
    if (dt.lateGame.includes(tick) && tick <= this.state.maxTick) {
      const situation = tick === 28
        ? '바론 내셔가 스폰됩니다! 어떻게 할까요?'
        : '엘더 드래곤 타이밍 — 이 교전이 승부를 가를 수 있습니다';

      return mode === 'manager'
        ? createLateGameDecision_Manager(tick, situation)
        : createLateGameDecision_Player(tick, situation);
    }

    return null;
  }

  private finishGame(): void {
    // 최종 교전
    const tick = this.state.maxTick;
    const winner: 'home' | 'away' = this.rand() < this.state.currentWinRate ? 'home' : 'away';
    const finalKills = 2 + Math.floor(this.rand() * 3);
    for (let k = 0; k < finalKills; k++) this.registerKill(tick, winner, '최종 교전');

    this.addCommentary(tick, pickCommentary(COMMENTARY_TEMPLATES.nexusDestroy, { side: sideLabel(winner) }), 'highlight');

    this.state.isFinished = true;
    this.state.winner = winner;
    this.state.phase = 'finished';
  }

  private registerKill(tick: number, side: 'home' | 'away', desc: string): void {
    if (side === 'home') {
      this.state.killsHome++;
      this.state.goldHome += 300;
    } else {
      this.state.killsAway++;
      this.state.goldAway += 300;
    }
    this.addEvent(tick, 'kill', side, desc, 300);

    // 선수별 킬/데스/어시 추적
    const killerStats = side === 'home' ? this.state.playerStatsHome : this.state.playerStatsAway;
    const victimStats = side === 'home' ? this.state.playerStatsAway : this.state.playerStatsHome;

    // 킬러: 가중치 랜덤 선택
    const killWeights = [0.18, 0.20, 0.22, 0.28, 0.12]; // top,jg,mid,adc,sup
    const r = this.rand();
    let cumulative = 0;
    let killerIdx = 0;
    for (let i = 0; i < killWeights.length; i++) {
      cumulative += killWeights[i];
      if (r < cumulative) { killerIdx = i; break; }
    }
    killerStats[killerIdx].kills++;

    // 피해자: 랜덤
    const victimIdx = Math.floor(this.rand() * 5);
    victimStats[victimIdx].deaths++;

    // 어시스트: 킬러 제외 1~2명
    const assistCount = 1 + Math.floor(this.rand() * 2);
    const assistCandidates = [0, 1, 2, 3, 4].filter(i => i !== killerIdx);
    for (let a = 0; a < Math.min(assistCount, assistCandidates.length); a++) {
      const idx = Math.floor(this.rand() * assistCandidates.length);
      killerStats[assistCandidates[idx]].assists++;
      assistCandidates.splice(idx, 1);
    }
  }

  private addEvent(tick: number, type: MatchEventType, side: 'home' | 'away', description: string, goldChange: number): void {
    this.state.events.push({ tick, type, side, description, goldChange });
  }

  private addCommentary(tick: number, message: string, type: Commentary['type']): void {
    this.state.commentary.push({ tick, message, type });
  }
}
