/**
 * 선수 성장/하락 시스템
 * - 시즌(스플릿) 종료 시 호출
 * - 나이, 잠재력, 포지션별 최적 나이에 따라 스탯 변동
 * - 훈련/폼에 따른 추가 보정
 * - 출전 경기 수에 따른 성장 가속/감속
 * - 코칭 보너스 (감독 능력치 + 철학 매칭)
 * - 고잠재력 선수 성장 부스트
 * - 일관성 기반 하락 완화
 */

import { GROWTH_CONSTANTS } from '../../data/systemPrompt';
import type { Position } from '../../types/game';
import type { Player, PlayerStats, PlayStyleArchetype } from '../../types/player';
import type { CoachingPhilosophy } from '../../types/staff';
import { createRng } from '../../utils/rng';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 성장 결과 */
export interface GrowthResult {
  playerId: string;
  oldStats: PlayerStats;
  newStats: PlayerStats;
  /** 각 스탯별 변동량 */
  changes: Record<keyof PlayerStats, number>;
  /** 성장 단계 */
  phase: 'growing' | 'peak' | 'declining';
}

/** 성장 계산 시 추가 컨텍스트 */
export interface GrowthContext {
  /** 이번 스플릿 출전 경기 수 */
  gamesPlayedThisSplit?: number;
  /** 감독 능력치 (0-100) */
  headCoachAbility?: number;
  /** 감독 코칭 철학 */
  coachingPhilosophy?: CoachingPhilosophy | null;
}

// ─────────────────────────────────────────
// 성장 단계 판별
// ─────────────────────────────────────────

type GrowthPhase = 'growing' | 'peak' | 'declining';

/** 선수의 현재 성장 단계 판별 */
function getGrowthPhase(age: number, position: Position): GrowthPhase {
  const peak = GROWTH_CONSTANTS.peakAge[position];
  if (age < peak.start) return 'growing';
  if (age <= peak.end) return 'peak';
  return 'declining';
}

// ─────────────────────────────────────────
// 출전 경기 수 보정
// ─────────────────────────────────────────

/**
 * 출전 경기 수에 따른 성장 배율
 * - 20+ 경기: +20% 성장 가속
 * - 5 미만 경기: -30% 성장 감속 (벤치)
 * - 5~19 경기: 기본 (1.0)
 */
function getPlaytimeFactor(gamesPlayed: number | undefined): number {
  if (gamesPlayed == null) return 1.0;
  if (gamesPlayed >= 20) return 1.2;
  if (gamesPlayed < 5) return 0.7;
  return 1.0;
}

// ─────────────────────────────────────────
// 코칭 보너스
// ─────────────────────────────────────────

/**
 * 감독 능력치/철학에 따른 성장 배율
 * - 능력 70+ → +10% 성장
 * - 철학이 선수 플레이스타일과 매칭 → 추가 +5%
 */
function getCoachingFactor(
  headCoachAbility: number | undefined,
  coachingPhilosophy: CoachingPhilosophy | null | undefined,
  playerPlaystyle: PlayStyleArchetype,
): number {
  let factor = 1.0;

  if (headCoachAbility != null && headCoachAbility > 70) {
    factor += 0.10;
  }

  if (coachingPhilosophy != null) {
    const matchMap: Record<CoachingPhilosophy, PlayStyleArchetype[]> = {
      aggressive: ['aggressive', 'carry'],
      defensive: ['passive', 'supportive'],
      balanced: ['versatile'],
      developmental: ['carry', 'aggressive', 'versatile'], // 육성형은 성장 지향 스타일과 매칭
    };
    if (matchMap[coachingPhilosophy].includes(playerPlaystyle)) {
      factor += 0.05;
    }
  }

  return factor;
}

// ─────────────────────────────────────────
// 고잠재력 부스트
// ─────────────────────────────────────────

/**
 * 잠재력 80 이상 선수는 성장기에 1.5배 성장
 */
function getHighPotentialFactor(potential: number, phase: GrowthPhase): number {
  if (phase === 'growing' && potential > 80) return 1.5;
  return 1.0;
}

// ─────────────────────────────────────────
// 일관성 기반 하락 완화
// ─────────────────────────────────────────

/**
 * 일관성(consistency)이 높은 선수는 하락기에 더 느리게 하락
 * consistency 80+ → 하락 속도 30% 감소
 * consistency 60~79 → 하락 속도 15% 감소
 */
function getConsistencyDeclineFactor(consistency: number, phase: GrowthPhase): number {
  if (phase !== 'declining') return 1.0;
  if (consistency >= 80) return 0.7; // 하락량의 70%만 적용 (30% 감소)
  if (consistency >= 60) return 0.85; // 하락량의 85%만 적용 (15% 감소)
  return 1.0;
}

// ─────────────────────────────────────────
// 스탯 변동 계산
// ─────────────────────────────────────────

/**
 * 단일 선수의 시즌 성장/하락 계산
 * @param player 선수 정보
 * @param seasonSeed 시즌 시드 (결정론적 랜덤)
 * @param averageForm 시즌 평균 폼 (0~100, 50이 기준)
 * @param context 추가 컨텍스트 (출전 수, 코칭 등)
 */
export function calculateGrowth(
  player: Player,
  seasonSeed: string,
  averageForm = 50,
  context: GrowthContext = {},
): GrowthResult {
  const rand = createRng(`${seasonSeed}_growth_${player.id}`);
  const phase = getGrowthPhase(player.age, player.position);
  const { growthRate } = GROWTH_CONSTANTS;

  // 성장 단계별 기본 변동 범위
  const range = phase === 'growing' ? growthRate.beforePeak
    : phase === 'peak' ? growthRate.atPeak
    : growthRate.afterPeak;

  // 잠재력 보정: 잠재력이 높을수록 성장 상한이 높아짐
  const potentialFactor = player.potential / 100; // 0~1

  // 추가 보정 계수들
  const playtimeFactor = getPlaytimeFactor(context.gamesPlayedThisSplit);
  const coachingFactor = getCoachingFactor(
    context.headCoachAbility,
    context.coachingPhilosophy,
    player.playstyle,
  );
  const highPotentialFactor = getHighPotentialFactor(player.potential, phase);
  const consistencyDeclineFactor = getConsistencyDeclineFactor(player.stats.consistency, phase);

  const statKeys: (keyof PlayerStats)[] = [
    'mechanical', 'gameSense', 'teamwork', 'consistency', 'laning', 'aggression',
  ];

  const oldStats = { ...player.stats };
  const newStats = { ...player.stats };
  const changes = {} as Record<keyof PlayerStats, number>;

  for (const stat of statKeys) {
    // 기본 변동: range 내에서 랜덤
    let baseChange = range.min + rand() * (range.max - range.min);

    // 잠재력 보정 (성장기에만 양방향 적용)
    const potentialBonus = phase === 'growing' ? baseChange * potentialFactor * 0.5 : 0;

    // 폼 보정: 평균 폼이 높으면 성장 촉진
    const formBonus = (averageForm - 50) * 0.02;

    // 스탯별 약간의 변동 차이
    const statVariance = (rand() - 0.5) * 1.5;

    let totalChange = baseChange + potentialBonus + formBonus + statVariance;

    // 성장기/피크: 출전 수 + 코칭 + 고잠재력 보정 적용
    if (phase === 'growing' || phase === 'peak') {
      totalChange *= playtimeFactor * coachingFactor * highPotentialFactor;
    }

    // 하락기: 일관성 기반 하락 완화 적용
    if (phase === 'declining') {
      totalChange *= consistencyDeclineFactor;
      // 하락기에도 출전 수 영향: 벤치 선수는 더 빠르게 하락
      if (context.gamesPlayedThisSplit != null && context.gamesPlayedThisSplit < 5) {
        totalChange *= 1.3; // 하락이 30% 가속 (음수이므로 더 큰 음수)
      }
    }

    totalChange = Math.round(totalChange * 10) / 10;

    // 스탯 범위 제한 (30~99)
    const rawNew = player.stats[stat] + totalChange;
    const clamped = Math.max(30, Math.min(99, Math.round(rawNew)));

    changes[stat] = clamped - player.stats[stat];
    newStats[stat] = clamped;
  }

  return {
    playerId: player.id,
    oldStats,
    newStats,
    changes,
    phase,
  };
}

/**
 * 팀 전체 선수의 시즌 성장/하락 계산
 */
export function calculateTeamGrowth(
  players: Player[],
  seasonSeed: string,
  playerFormAverages: Record<string, number> = {},
  playerGamesPlayed: Record<string, number> = {},
  headCoachAbility?: number,
  coachingPhilosophy?: CoachingPhilosophy | null,
): GrowthResult[] {
  return players.map(player => {
    const avgForm = playerFormAverages[player.id] ?? 50;
    const context: GrowthContext = {
      gamesPlayedThisSplit: playerGamesPlayed[player.id],
      headCoachAbility,
      coachingPhilosophy,
    };
    return calculateGrowth(player, seasonSeed, avgForm, context);
  });
}
