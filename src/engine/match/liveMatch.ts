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
import {
  type Lineup,
  type MatchupResult,
  evaluateMatchup,
  calculatePlayerRating,
} from './teamRating';
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

  /** 게임 종료 여부 */
  isFinished: boolean;
  /** 승리 팀 */
  winner?: 'home' | 'away';
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
  }) {
    this.matchup = evaluateMatchup(
      params.homeLineup,
      params.awayLineup,
      params.homeTraits ?? {},
      params.awayTraits ?? {},
      params.homeForm ?? {},
      params.awayForm ?? {},
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
      isFinished: false,
    };
  }

  /** 현재 상태 조회 (읽기 전용) */
  getState(): Readonly<LiveGameState> {
    return this.state;
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

    // 페이즈 업데이트
    if (tick <= 1) {
      this.state.phase = 'laning';
      this.addCommentary(0, '경기가 시작됩니다!', 'info');
    } else if (tick === MATCH_CONSTANTS.laningPhaseEnd + 1) {
      this.state.phase = 'mid_game';
      this.addCommentary(tick, '라인전이 종료되고 중반으로 넘어갑니다', 'info');
    } else if (tick === 25) {
      this.state.phase = 'late_game';
      this.addCommentary(tick, '후반 진입 — 바론과 엘더 드래곤이 중요해집니다', 'info');
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

    // ── 라인전 (1~15분) ──
    if (tick <= 15) {
      // 매 3분마다 CS 골드 차이 업데이트
      if (tick % 3 === 0) {
        const laningDiff = matchup.homeRating.laningPower - matchup.awayRating.laningPower;
        const csGold = Math.round(laningDiff * 5 + (this.rand() - 0.5) * 100);
        if (csGold > 0) this.state.goldHome += csGold;
        else this.state.goldAway += Math.abs(csGold);
      }

      // 솔로킬 (5분부터, ~15% 확률/분)
      if (tick >= 5 && this.rand() < 0.08) {
        const killer = this.rand() < wr ? 'home' : 'away';
        this.registerKill(tick, killer, '라인전 솔로킬');
      }

      // 갱킹 (4분부터, ~10% 확률/분)
      if (tick >= 4 && this.rand() < 0.06) {
        const jglDiff = matchup.laneMatchups.jungle;
        const success = this.rand() < 0.5 + jglDiff * 0.01;
        const ganker = (jglDiff > 0 && success) ? 'home' : 'away';
        this.registerKill(tick, ganker, '정글 갱킹');
        this.addCommentary(tick, `${ganker === 'home' ? '블루' : '레드'}팀 정글러의 갱킹!`, 'kill');
      }
    }

    // ── 중반 (16~24분) ──
    if (tick > 15 && tick <= 24) {
      // 드래곤 (18, 22분)
      if (tick === 18 || tick === 22) {
        const tfDiff = matchup.homeRating.teamfightPower - matchup.awayRating.teamfightPower;
        const dragonWin = this.rand() < 0.5 + tfDiff * 0.008 + (wr - 0.5) * 0.2;
        const side = dragonWin ? 'home' : 'away';

        if (side === 'home') this.state.dragonsHome++;
        else this.state.dragonsAway++;

        this.addEvent(tick, 'dragon', side, '드래곤 처치', 200);
        this.addCommentary(tick, `${side === 'home' ? '블루' : '레드'}팀이 드래곤을 확보합니다!`, 'objective');

        // 드래곤 교전 킬
        if (this.rand() < 0.5) {
          const kills = 1 + Math.floor(this.rand() * 2);
          for (let k = 0; k < kills; k++) this.registerKill(tick, side, '드래곤 교전');
          this.addCommentary(tick, `드래곤 교전에서 ${kills}킬!`, 'teamfight');
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

      // 소규모 교전
      if (this.rand() < 0.05) {
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
        this.addCommentary(tick, `${side === 'home' ? '블루' : '레드'}팀 바론 내셔 처치!`, 'objective');

        // 바론 교전
        if (this.rand() < 0.6) {
          const kills = 2 + Math.floor(this.rand() * 3);
          for (let k = 0; k < kills; k++) this.registerKill(tick, side, '바론 교전');
          this.addCommentary(tick, `바론 앞 대규모 교전! ${kills}킬!`, 'teamfight');
        }
      }

      // 타워 파괴 (바론 후)
      if ((this.state.baronHome || this.state.baronAway) && this.rand() < 0.3) {
        const side = this.state.baronHome ? 'home' : 'away';
        if (side === 'home') this.state.towersHome++;
        else this.state.towersAway++;
        this.addEvent(tick, 'tower_destroy', side, '내부 타워 파괴', 550);
      }

      // 후반 교전
      if (this.rand() < 0.08) {
        const winner = this.rand() < wr ? 'home' : 'away';
        const kills = 1 + Math.floor(this.rand() * 2);
        for (let k = 0; k < kills; k++) this.registerKill(tick, winner, '후반 교전');
        this.addCommentary(tick, `한타 발생! ${winner === 'home' ? '블루' : '레드'}팀 ${kills}킬!`, 'teamfight');
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

    this.addCommentary(tick, `${winner === 'home' ? '블루' : '레드'}팀이 넥서스를 파괴합니다! GG!`, 'highlight');

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
  }

  private addEvent(tick: number, type: MatchEventType, side: 'home' | 'away', description: string, goldChange: number): void {
    this.state.events.push({ tick, type, side, description, goldChange });
  }

  private addCommentary(tick: number, message: string, type: Commentary['type']): void {
    this.state.commentary.push({ tick, message, type });
  }
}
