import type { Player } from '../../types/player';
import type { Position } from '../../types/game';
import { FINANCIAL_CONSTANTS } from '../../data/systemPrompt';
import { getPlayerOverall } from '../../utils/playerUtils';

export const SALARY_CAP = FINANCIAL_CONSTANTS.salaryCap * 10000;
export const POSITIONS: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
export const AI_TRANSFER_ATTEMPT_RATE = 0.1;
export const WEAK_POSITION_THRESHOLD = 60;

const AGE_VALUE_CURVE: Record<number, number> = {
  17: 0.7, 18: 0.85, 19: 0.95, 20: 1.0, 21: 1.05, 22: 1.1,
  23: 1.1, 24: 1.05, 25: 1.0, 26: 0.9, 27: 0.75, 28: 0.6,
  29: 0.45, 30: 0.3,
};

export function getAgeFactor(age: number): number {
  if (age in AGE_VALUE_CURVE) return AGE_VALUE_CURVE[age];
  if (age < 17) return 0.5;
  return 0.2;
}

export function calculatePlayerValue(player: Player): number {
  const ovr = getPlayerOverall(player);
  const ageFactor = getAgeFactor(player.age);
  const potentialFactor = 0.8 + (player.potential / 100) * 0.4;
  const popFactor = 0.9 + (player.popularity / 100) * 0.2;
  const baseValue = ovr * 200;
  const value = baseValue * ageFactor * potentialFactor * popFactor;

  return Math.round(Math.max(value, 1000));
}

export function calculateFairSalary(player: Player): number {
  const ovr = getPlayerOverall(player);
  const ageFactor = getAgeFactor(player.age);
  const baseSalary = ovr * 50;
  const salary = baseSalary * ageFactor;

  return Math.round(Math.max(salary, 500));
}

export function calculateAgentFee(transferFee: number): number {
  if (transferFee <= 0) return 0;
  return Math.max(500, Math.round(transferFee * 0.05));
}

export function findWeakestPosition(roster: Player[]): { position: Position; currentOvr: number } | null {
  let weakest: { position: Position; currentOvr: number } | null = null;

  for (const pos of POSITIONS) {
    const posPlayers = roster.filter(p => p.position === pos);

    if (posPlayers.length === 0) {
      return { position: pos, currentOvr: 0 };
    }

    const bestOvr = Math.max(...posPlayers.map(p => getPlayerOverall(p)));

    if (!weakest || bestOvr < weakest.currentOvr) {
      weakest = { position: pos, currentOvr: bestOvr };
    }
  }

  return weakest;
}
