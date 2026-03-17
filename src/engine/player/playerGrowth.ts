/**
 * 선수 성장/하락 시스템
 * - 시즌(스플릿) 종료 시 호출
 * - 나이, 잠재력, 포지션별 최적 나이에 따라 스탯 변동
 * - 훈련/폼에 따른 추가 보정
 */

import { GROWTH_CONSTANTS } from '../../data/systemPrompt';
import type { Position } from '../../types/game';
import type { Player, PlayerStats } from '../../types/player';
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
// 스탯 변동 계산
// ─────────────────────────────────────────

/**
 * 단일 선수의 시즌 성장/하락 계산
 * @param player 선수 정보
 * @param seasonSeed 시즌 시드 (결정론적 랜덤)
 * @param averageForm 시즌 평균 폼 (0~100, 50이 기준)
 */
export function calculateGrowth(
  player: Player,
  seasonSeed: string,
  averageForm = 50,
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

  const statKeys: (keyof PlayerStats)[] = [
    'mechanical', 'gameSense', 'teamwork', 'consistency', 'laning', 'aggression',
  ];

  const oldStats = { ...player.stats };
  const newStats = { ...player.stats };
  const changes = {} as Record<keyof PlayerStats, number>;

  for (const stat of statKeys) {
    // 기본 변동: range 내에서 랜덤
    const baseChange = range.min + rand() * (range.max - range.min);

    // 잠재력 보정 (성장기에만 양방향 적용)
    const potentialBonus = phase === 'growing' ? baseChange * potentialFactor * 0.5 : 0;

    // 폼 보정: 평균 폼이 높으면 성장 촉진
    const formBonus = (averageForm - 50) * 0.02;

    // 스탯별 약간의 변동 차이
    const statVariance = (rand() - 0.5) * 1.5;

    let totalChange = baseChange + potentialBonus + formBonus + statVariance;
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
): GrowthResult[] {
  return players.map(player => {
    const avgForm = playerFormAverages[player.id] ?? 50;
    return calculateGrowth(player, seasonSeed, avgForm);
  });
}
