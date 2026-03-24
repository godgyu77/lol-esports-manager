/**
 * 난이도 시스템
 * - easy / normal / hard 3단계
 * - 각 난이도별 AI 팀 보정, 유저 예산/성장/부상/이적 배율 제공
 */

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyModifiers {
  /** AI팀 전력 보정 (easy:-3, normal:0, hard:+3) */
  aiTeamRatingBonus: number;
  /** 유저 예산 배율 (easy:1.3, normal:1.0, hard:0.8) */
  userBudgetMultiplier: number;
  /** 유저팀 성장 배율 (easy:1.2, normal:1.0, hard:0.9) */
  playerGrowthMultiplier: number;
  /** 부상 확률 배율 (easy:0.7, normal:1.0, hard:1.3) */
  injuryRateMultiplier: number;
  /** AI 이적 공격성 (easy:0.8, normal:1.0, hard:1.2) */
  aiTransferAggression: number;
}

const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyModifiers> = {
  easy: {
    aiTeamRatingBonus: -3,
    userBudgetMultiplier: 1.3,
    playerGrowthMultiplier: 1.2,
    injuryRateMultiplier: 0.7,
    aiTransferAggression: 0.8,
  },
  normal: {
    aiTeamRatingBonus: 0,
    userBudgetMultiplier: 1.0,
    playerGrowthMultiplier: 1.0,
    injuryRateMultiplier: 1.0,
    aiTransferAggression: 1.0,
  },
  hard: {
    aiTeamRatingBonus: 3,
    userBudgetMultiplier: 0.8,
    playerGrowthMultiplier: 0.9,
    injuryRateMultiplier: 1.3,
    aiTransferAggression: 1.2,
  },
};

/**
 * 난이도에 따른 보정 값 반환
 */
export function getDifficultyModifiers(difficulty: Difficulty): DifficultyModifiers {
  return DIFFICULTY_PRESETS[difficulty];
}
