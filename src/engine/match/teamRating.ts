/**
 * 팀 전력 평가 엔진
 * - 선수 개인 전투력 → 포지션 매치업 → 팀 종합 전력 → 승률 산출
 * - 특성(trait), 멘탈/컨디션, 챔피언 숙련도 보정 포함
 */

import { MATCH_CONSTANTS } from '../../data/systemPrompt';
import { TRAIT_LIBRARY, type TraitTier } from '../../data/traitLibrary';
import type { Position } from '../../types/game';
import type { Player } from '../../types/player';
import type { PlayStyle } from '../../types/team';
import type { ChampionSynergy, ChampionTag } from '../../types/champion';

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

/**
 * 선수의 6개 스탯 → 단일 전투력 수치 (0~100)
 * @param champProficiency 해당 경기에서 사용하는 챔피언 숙련도 (0-100)
 * @param champDifficulty 챔피언 조작 난이도 (0-100)
 */
export function calculatePlayerRating(
  player: Player,
  champProficiency?: number,
  champDifficulty?: number,
): number {
  const s = player.stats;

  const raw =
    s.mechanical * 0.20 +
    s.gameSense * 0.20 +
    s.teamwork * 0.15 +
    s.consistency * 0.15 +
    s.laning * 0.15 +
    s.aggression * 0.15;

  // 챔피언 숙련도 보정: 숙련도 50 기준, ±5% 범위
  let proficiencyMod = 0;
  if (champProficiency !== undefined) {
    proficiencyMod = (champProficiency - 50) * 0.1; // 100숙련 → +5, 0숙련 → -5
  }

  // 챔피언 난이도 페널티: 난이도 높고 mechanical 낮으면 페널티
  let difficultyPenalty = 0;
  if (champDifficulty !== undefined && champDifficulty > 60) {
    const mechanicalGap = champDifficulty - s.mechanical;
    if (mechanicalGap > 0) {
      difficultyPenalty = mechanicalGap * 0.05; // 난이도 80, mechanical 60 → -1
    }
  }

  return raw + proficiencyMod - difficultyPenalty;
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
  /** 포지션별 챔피언 숙련도 (선택) */
  champProficiency?: Record<Position, number>,
  /** 포지션별 챔피언 난이도 (선택) */
  champDifficulty?: Record<Position, number>,
  /** 케미스트리 보너스 (-5 ~ +5, 선택) */
  chemistryBonus?: number,
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
    const rating = calculatePlayerRating(
      player,
      champProficiency?.[pos],
      champDifficulty?.[pos],
    );
    const mental = calculateMentalModifier(player);
    const traits = playerTraits[player.id] ?? [];
    const traitBonus = calculateTraitBonus(traits);

    // 폼 보정: 50 기준, ±10 범위 (폼 100 → +10, 폼 0 → -10) — 2배 강화
    const form = playerForm[player.id] ?? 50;
    const formBonus = (form - 50) * 0.2;

    // 폼 기반 전투력 보정 (선형 보너스만 적용)
    const posRating = rating + mental + traitBonus + formBonus;

    byPosition[pos] = posRating;
    weightedSum += posRating * weights[pos];
    laningSum += calculateLaningRating(player) * weights[pos];
    teamfightSum += calculateTeamfightRating(player) * weights[pos];
    traitBonusTotal += traitBonus;
    mentalTotal += mental;
  }

  const extraBonus = Math.max(-6, Math.min(6, chemistryBonus ?? 0));
  const finalOverall = weightedSum + extraBonus;

  return {
    overall: clamp(finalOverall),
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
/**
 * PlayStyle 상성 보정값
 * aggressive > split > controlled > aggressive
 * 유리 시 +0.04, 불리 시 -0.04, 동일 시 0
 */
function getPlayStyleAdvantage(home: PlayStyle, away: PlayStyle): number {
  if (home === away) return 0;
  if (
    (home === 'aggressive' && away === 'split') ||
    (home === 'split' && away === 'controlled') ||
    (home === 'controlled' && away === 'aggressive')
  ) return 0.04;
  return -0.04;
}

export function evaluateMatchup(
  homeLineup: Lineup,
  awayLineup: Lineup,
  homeTraits: Record<string, string[]> = {},
  awayTraits: Record<string, string[]> = {},
  homeForm: Record<string, number> = {},
  awayForm: Record<string, number> = {},
  homePlayStyle: PlayStyle = 'controlled',
  awayPlayStyle: PlayStyle = 'controlled',
  homeChampProf?: Record<Position, number>,
  awayChampProf?: Record<Position, number>,
  homeChampDiff?: Record<Position, number>,
  awayChampDiff?: Record<Position, number>,
  /** 홈 팀 케미스트리+솔로랭크 합산 보너스 */
  homeExtraBonus?: number,
  /** 어웨이 팀 케미스트리+솔로랭크 합산 보너스 */
  awayExtraBonus?: number,
): MatchupResult {
  const homeRating = evaluateTeam(homeLineup, homeTraits, homeForm, homeChampProf, homeChampDiff, homeExtraBonus);
  const awayRating = evaluateTeam(awayLineup, awayTraits, awayForm, awayChampProf, awayChampDiff, awayExtraBonus);

  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

  // 포지션별 매치업 차이
  const laneMatchups = {} as Record<Position, number>;
  for (const pos of positions) {
    laneMatchups[pos] = homeRating.byPosition[pos] - awayRating.byPosition[pos];
  }

  // 승률 계산: 시그모이드 함수 기반
  const ratingDiff = homeRating.overall - awayRating.overall;
  const rawWinRate = sigmoid(ratingDiff * 0.08);

  // PlayStyle 상성 보정 적용 (rawWinRate에 더한 뒤 clamp)
  const styleAdv = getPlayStyleAdvantage(homePlayStyle, awayPlayStyle);
  const homeWinRate = clampWinRate(rawWinRate + styleAdv);

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

/** 라인업 구성: 팀 로스터에서 포지션별 1군 선수 자동 선택 (부상 선수 제외) */
export function buildLineup(
  roster: (Player & { division: string })[],
  injuredPlayerIds?: Set<string>,
): Lineup | null {
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const lineup = {} as Record<Position, Player>;

  for (const pos of positions) {
    // 1군(main) 선수 중 부상이 아닌 해당 포지션 선수를 찾음
    let candidate = roster.find(
      p => p.position === pos && p.division === 'main' && !(injuredPlayerIds?.has(p.id)),
    );

    // 부포지션(secondaryPosition) 선수도 탐색
    if (!candidate) {
      candidate = roster.find(
        p => (p as unknown as { secondaryPosition?: string }).secondaryPosition === pos
          && p.division === 'main' && !(injuredPlayerIds?.has(p.id))
          && !positions.some(usedPos => lineup[usedPos]?.id === p.id),
      );
    }

    // 1군에 없으면 (부상 등) 2군(academy)에서 대체 선수 탐색
    if (!candidate) {
      candidate = roster.find(
        p => p.position === pos && p.division === 'academy' && !(injuredPlayerIds?.has(p.id)),
      );
    }

    if (!candidate) return null; // 해당 포지션에 출전 가능 선수 없음
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

// ─────────────────────────────────────────
// 챔피언 시너지 & 팀 구성 평가
// ─────────────────────────────────────────

/**
 * 챔피언 상성 보너스 계산
 * 아군 챔피언 간 시너지 + 상대 챔피언 카운터
 * @returns -10 ~ +10 보너스
 */
export function calculateChampionSynergyBonus(
  teamPicks: { championId: string; position: Position }[],
  opponentPicks: { championId: string; position: Position }[],
  synergyData: ChampionSynergy[],
): number {
  if (synergyData.length === 0) return 0;

  let bonus = 0;
  const synergyMap = new Map<string, number>();
  for (const s of synergyData) {
    synergyMap.set(`${s.championA}_${s.championB}`, s.synergy);
    synergyMap.set(`${s.championB}_${s.championA}`, s.synergy);
  }

  // 아군 챔피언 간 시너지
  for (let i = 0; i < teamPicks.length; i++) {
    for (let j = i + 1; j < teamPicks.length; j++) {
      const key = `${teamPicks[i].championId}_${teamPicks[j].championId}`;
      const synergy = synergyMap.get(key) ?? 0;
      bonus += synergy * 0.05; // ±100 시너지 → ±5 보너스
    }
  }

  // 상대 챔피언 카운터 (같은 라인 상성)
  for (const mine of teamPicks) {
    const opponent = opponentPicks.find(p => p.position === mine.position);
    if (!opponent) continue;
    const key = `${mine.championId}_${opponent.championId}`;
    const synergy = synergyMap.get(key) ?? 0;
    if (synergy < 0) {
      // 내 챔피언이 상대에 대해 불리 → 페널티
      bonus += synergy * 0.03;
    } else if (synergy > 0) {
      // 내 챔피언이 상대에 대해 유리 → 보너스
      bonus += synergy * 0.03;
    }
  }

  return Math.max(-10, Math.min(10, bonus));
}

/**
 * 팀 구성 시너지 평가
 * AP/AD 균형, 이니시에이터 존재, 한타 잠재력
 * @returns -10 ~ +10 보너스
 */
export function evaluateTeamComposition(
  picks: { championId: string; tags: ChampionTag[]; teamfight: number; damageType?: 'ap' | 'ad' | 'mixed' }[],
): number {
  let bonus = 0;

  // AP/AD 균형 체크 (같은 타입만 있으면 페널티)
  const damageTypes = picks.map(p => p.damageType ?? 'mixed');
  const allAP = damageTypes.every(t => t === 'ap');
  const allAD = damageTypes.every(t => t === 'ad');
  if (allAP || allAD) bonus -= 5;

  // 이니시에이터 존재 체크
  const hasEngage = picks.some(p => p.tags.includes('engage'));
  if (hasEngage) bonus += 3;

  // 한타 잠재력 (teamfight 합산)
  const totalTeamfight = picks.reduce((sum, p) => sum + p.teamfight, 0);
  if (totalTeamfight >= 400) bonus += 2;
  else if (totalTeamfight >= 350) bonus += 1;
  else if (totalTeamfight < 250) bonus -= 2;

  // 탱커 존재 체크
  const hasTank = picks.some(p => p.tags.includes('tank'));
  if (hasTank) bonus += 1;

  return Math.max(-10, Math.min(10, bonus));
}
