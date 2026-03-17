/**
 * 팀 전력 평가 엔진
 * - 선수 개인 전투력 → 포지션 매치업 → 팀 종합 전력 → 승률 산출
 * - 특성(trait), 멘탈/컨디션, 챔피언 숙련도 보정 포함
 */

import { MATCH_CONSTANTS } from '../../data/systemPrompt';
import { TRAIT_LIBRARY, type TraitTier } from '../../data/traitLibrary';
import type { Position } from '../../types/game';
import type { Player } from '../../types/player';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

/** 포지션별 선수 배치 (1군 라인업) */
export type Lineup = Record<Position, Player>;

/** 팀 전력 평가 결과 */
export interface TeamRating {
  /** 종합 전력 (0~100) */
  overall: number;
  /** 포지션별 전력 */
  byPosition: Record<Position, number>;
  /** 라인전 전력 (초반) */
  laningPower: number;
  /** 한타 전력 (중후반) */
  teamfightPower: number;
  /** 특성 보정 합산 */
  traitBonus: number;
  /** 멘탈/컨디션 보정 */
  mentalModifier: number;
}

/** 매치업 비교 결과 */
export interface MatchupResult {
  homeRating: TeamRating;
  awayRating: TeamRating;
  /** 홈 팀 승률 (0~1) */
  homeWinRate: number;
  /** 포지션별 유리/불리 (-100~+100, 양수면 홈 유리) */
  laneMatchups: Record<Position, number>;
}

// ─────────────────────────────────────────
// 선수 개인 전투력
// ─────────────────────────────────────────

/** 선수의 6개 스탯 → 단일 전투력 수치 (0~100) */
export function calculatePlayerRating(player: Player): number {
  const s = player.stats;

  // 가중 평균: mechanical과 gameSense가 약간 더 중요
  const raw =
    s.mechanical * 0.20 +
    s.gameSense * 0.20 +
    s.teamwork * 0.15 +
    s.consistency * 0.15 +
    s.laning * 0.15 +
    s.aggression * 0.15;

  return raw;
}

/** 선수의 라인전 특화 전력 */
export function calculateLaningRating(player: Player): number {
  const s = player.stats;
  return s.laning * 0.35 + s.mechanical * 0.30 + s.aggression * 0.20 + s.consistency * 0.15;
}

/** 선수의 한타 특화 전력 */
export function calculateTeamfightRating(player: Player): number {
  const s = player.stats;
  return s.teamwork * 0.30 + s.gameSense * 0.25 + s.mechanical * 0.25 + s.consistency * 0.20;
}

// ─────────────────────────────────────────
// 멘탈/컨디션 보정
// ─────────────────────────────────────────

/**
 * 멘탈 보정값 (-10 ~ +10)
 * mental/stamina/morale이 높을수록 +, 낮으면 -
 */
export function calculateMentalModifier(player: Player): number {
  const m = player.mental;
  // 각 수치의 기본값(70~80)으로부터의 편차를 보정값으로 변환
  const mentalDelta = (m.mental - 70) * 0.1;
  const staminaDelta = (m.stamina - 80) * 0.08;
  const moraleDelta = (m.morale - 70) * 0.12;

  return mentalDelta + staminaDelta + moraleDelta;
}

// ─────────────────────────────────────────
// 특성(Trait) 보정
// ─────────────────────────────────────────

/**
 * 선수 특성 목록 → 전력 보정값
 * traitImpact: S 0.08, A 0.05, B 0.03, C 0.01, NEG -0.04
 * → 100점 스케일로 변환 (*100)
 */
export function calculateTraitBonus(traitIds: string[]): number {
  const impact = MATCH_CONSTANTS.traitImpact;
  let bonus = 0;

  for (const traitId of traitIds) {
    const trait = TRAIT_LIBRARY[traitId];
    if (!trait) continue;

    const tierMap: Record<TraitTier, number> = {
      S: impact.S * 100,
      A: impact.A * 100,
      B: impact.B * 100,
      C: impact.C * 100,
      NEG: impact.NEG * 100,
    };

    bonus += tierMap[trait.tier] ?? 0;
  }

  return bonus;
}

// ─────────────────────────────────────────
// 팀 전력 평가
// ─────────────────────────────────────────

/**
 * 라인업 → 팀 종합 전력 평가
 * @param lineup 포지션별 선수 배치
 * @param playerTraits 선수 ID → 특성 ID 배열 매핑
 * @param playerForm 선수 ID → 폼 수치 (0~100, 50이 기준)
 */
export function evaluateTeam(
  lineup: Lineup,
  playerTraits: Record<string, string[]> = {},
  playerForm: Record<string, number> = {},
): TeamRating {
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const weights = MATCH_CONSTANTS.positionWeight;

  const byPosition = {} as Record<Position, number>;
  let weightedSum = 0;
  let laningSum = 0;
  let teamfightSum = 0;
  let traitBonusTotal = 0;
  let mentalTotal = 0;

  for (const pos of positions) {
    const player = lineup[pos];
    const rating = calculatePlayerRating(player);
    const mental = calculateMentalModifier(player);
    const traits = playerTraits[player.id] ?? [];
    const traitBonus = calculateTraitBonus(traits);

    // 폼 보정: 50 기준, ±5 범위 (폼 100 → +5, 폼 0 → -5)
    const form = playerForm[player.id] ?? 50;
    const formBonus = (form - 50) * 0.1;

    byPosition[pos] = rating + mental + traitBonus + formBonus;
    weightedSum += (rating + mental + traitBonus + formBonus) * weights[pos];
    laningSum += calculateLaningRating(player) * weights[pos];
    teamfightSum += calculateTeamfightRating(player) * weights[pos];
    traitBonusTotal += traitBonus;
    mentalTotal += mental;
  }

  return {
    overall: clamp(weightedSum),
    byPosition,
    laningPower: clamp(laningSum),
    teamfightPower: clamp(teamfightSum),
    traitBonus: traitBonusTotal,
    mentalModifier: mentalTotal,
  };
}

// ─────────────────────────────────────────
// 매치업 비교 & 승률 계산
// ─────────────────────────────────────────

/**
 * 두 팀의 전력 비교 → 승률 산출
 * @param homeLineup 홈 팀 라인업
 * @param awayLineup 어웨이 팀 라인업
 * @param homeTraits 홈 팀 선수별 특성
 * @param awayTraits 어웨이 팀 선수별 특성
 * @param homeForm 홈 팀 선수별 폼
 * @param awayForm 어웨이 팀 선수별 폼
 */
export function evaluateMatchup(
  homeLineup: Lineup,
  awayLineup: Lineup,
  homeTraits: Record<string, string[]> = {},
  awayTraits: Record<string, string[]> = {},
  homeForm: Record<string, number> = {},
  awayForm: Record<string, number> = {},
): MatchupResult {
  const homeRating = evaluateTeam(homeLineup, homeTraits, homeForm);
  const awayRating = evaluateTeam(awayLineup, awayTraits, awayForm);

  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  // 포지션별 매치업 차이
  const laneMatchups = {} as Record<Position, number>;
  for (const pos of positions) {
    laneMatchups[pos] = homeRating.byPosition[pos] - awayRating.byPosition[pos];
  }

  // 승률 계산: 시그모이드 함수 기반
  // 전력 차이를 승률로 변환 (차이 0 = 50%, 차이 10 ≈ 73%, 차이 20 ≈ 88%)
  const ratingDiff = homeRating.overall - awayRating.overall;
  const rawWinRate = sigmoid(ratingDiff * 0.08);

  // 업셋 보장: OVR 차이가 커도 약팀 승률 최소 15%
  const homeWinRate = clampWinRate(rawWinRate);

  return {
    homeRating,
    awayRating,
    homeWinRate,
    laneMatchups,
  };
}

// ─────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────

/** 라인업 구성: 팀 로스터에서 포지션별 1군 선수 자동 선택 */
export function buildLineup(roster: (Player & { division: string })[]): Lineup | null {
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const lineup = {} as Record<Position, Player>;

  for (const pos of positions) {
    // 1군(main) 선수 중 해당 포지션 선수를 찾음
    const candidate = roster.find(p => p.position === pos && p.division === 'main');
    if (!candidate) return null; // 해당 포지션에 1군 선수 없음
    lineup[pos] = candidate;
  }

  return lineup as Lineup;
}

/** 시그모이드 함수: 전력 차이 → 확률 (0~1) */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** 값을 0~100 범위로 제한 */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

/** 승률 범위 제한: 최소 15%, 최대 85% (업셋 보장) */
function clampWinRate(rate: number): number {
  return Math.max(0.15, Math.min(0.85, rate));
}
