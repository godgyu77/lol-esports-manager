import { describe, it, expect } from 'vitest';
import {
  getPersonalityEffects,
  calculatePersonalityCompatibility,
} from './personalityEngine';
import type { PlayerPersonality } from '../../types/personality';

function createPersonality(
  overrides: Partial<Omit<PlayerPersonality, 'playerId'>> = {},
): PlayerPersonality {
  return {
    playerId: 'test-player',
    ambition: 5,
    loyalty: 5,
    professionalism: 5,
    temperament: 5,
    determination: 5,
    ...overrides,
  };
}

describe('personalityEngine', () => {
  describe('getPersonalityEffects', () => {
    it('professionalism 8+ 이면 trainingEfficiencyBonus가 10이어야 한다', () => {
      const p = createPersonality({ professionalism: 8 });
      const effects = getPersonalityEffects(p);
      expect(effects.trainingEfficiencyBonus).toBe(10);
    });

    it('professionalism 5-7 이면 trainingEfficiencyBonus가 0이어야 한다', () => {
      const p = createPersonality({ professionalism: 5 });
      const effects = getPersonalityEffects(p);
      expect(effects.trainingEfficiencyBonus).toBe(0);
    });

    it('professionalism 4 이하면 trainingEfficiencyBonus가 -5이어야 한다', () => {
      const p = createPersonality({ professionalism: 3 });
      const effects = getPersonalityEffects(p);
      expect(effects.trainingEfficiencyBonus).toBe(-5);
    });

    it('ambition 8+ 이면 transferRequestMultiplier가 2.0이어야 한다', () => {
      const p = createPersonality({ ambition: 8 });
      const effects = getPersonalityEffects(p);
      expect(effects.transferRequestMultiplier).toBe(2.0);
    });

    it('ambition 6-7 이면 transferRequestMultiplier가 1.2이어야 한다', () => {
      const p = createPersonality({ ambition: 6 });
      const effects = getPersonalityEffects(p);
      expect(effects.transferRequestMultiplier).toBe(1.2);
    });

    it('ambition 5 이하면 transferRequestMultiplier가 0.8이어야 한다', () => {
      const p = createPersonality({ ambition: 5 });
      const effects = getPersonalityEffects(p);
      expect(effects.transferRequestMultiplier).toBe(0.8);
    });

    it('determination 8+ 이면 injuryRecoveryBonus가 -20이어야 한다', () => {
      const p = createPersonality({ determination: 8 });
      const effects = getPersonalityEffects(p);
      expect(effects.injuryRecoveryBonus).toBe(-20);
    });

    it('determination 5-7 이면 injuryRecoveryBonus가 0이어야 한다', () => {
      const p = createPersonality({ determination: 6 });
      const effects = getPersonalityEffects(p);
      expect(effects.injuryRecoveryBonus).toBe(0);
    });

    it('determination 4 이하면 injuryRecoveryBonus가 10이어야 한다', () => {
      const p = createPersonality({ determination: 3 });
      const effects = getPersonalityEffects(p);
      expect(effects.injuryRecoveryBonus).toBe(10);
    });

    it('loyalty 8+ 이면 renewalAcceptBonus가 20이어야 한다', () => {
      const p = createPersonality({ loyalty: 8 });
      const effects = getPersonalityEffects(p);
      expect(effects.renewalAcceptBonus).toBe(20);
    });

    it('temperament 3 이하면 teamTalkSensitivity가 2.0이어야 한다', () => {
      const p = createPersonality({ temperament: 3 });
      const effects = getPersonalityEffects(p);
      expect(effects.teamTalkSensitivity).toBe(2.0);
    });

    it('pressureResistance는 0과 1 사이여야 한다', () => {
      const p = createPersonality({ temperament: 10, determination: 10, professionalism: 10 });
      const effects = getPersonalityEffects(p);
      expect(effects.pressureResistance).toBeGreaterThanOrEqual(0);
      expect(effects.pressureResistance).toBeLessThanOrEqual(1);
    });

    it('teamTalkResponseMultiplier에 모든 톤이 존재해야 한다', () => {
      const p = createPersonality();
      const effects = getPersonalityEffects(p);
      const tones = ['motivate', 'calm', 'warn', 'praise', 'criticize', 'neutral'] as const;
      for (const tone of tones) {
        expect(effects.teamTalkResponseMultiplier).toHaveProperty(tone);
      }
    });
  });

  describe('calculatePersonalityCompatibility', () => {
    it('동일한 성격 → 높은 호환성을 반환해야 한다', () => {
      const a = createPersonality({
        professionalism: 7, determination: 7, temperament: 7, loyalty: 7, ambition: 5,
      });
      const b = createPersonality({
        professionalism: 7, determination: 7, temperament: 7, loyalty: 7, ambition: 5,
      });
      const score = calculatePersonalityCompatibility(a, b);
      expect(score).toBeGreaterThan(0);
    });

    it('둘 다 기질 낮음(3 이하) → -3 페널티가 적용되어야 한다', () => {
      const a = createPersonality({ temperament: 2, professionalism: 5, determination: 5, loyalty: 5, ambition: 5 });
      const b = createPersonality({ temperament: 3, professionalism: 5, determination: 5, loyalty: 5, ambition: 5 });
      const score = calculatePersonalityCompatibility(a, b);
      // profDiff=0 → +3, detDiff=0 → +2, 둘 다 temperament<=3 → -3 = 2
      expect(score).toBe(2);
    });

    it('둘 다 충성심 높음(7+) → +2 보너스가 적용되어야 한다', () => {
      const base = createPersonality({
        professionalism: 5, determination: 5, temperament: 5, loyalty: 7, ambition: 5,
      });
      const withLoyalty = calculatePersonalityCompatibility(base, base);

      const noLoyalty = createPersonality({
        professionalism: 5, determination: 5, temperament: 5, loyalty: 3, ambition: 5,
      });
      const withoutLoyalty = calculatePersonalityCompatibility(noLoyalty, noLoyalty);

      expect(withLoyalty).toBeGreaterThan(withoutLoyalty);
    });

    it('둘 다 야망 높음(8+) → -2 페널티가 적용되어야 한다', () => {
      const lowAmbition = createPersonality({
        professionalism: 5, determination: 5, temperament: 5, loyalty: 5, ambition: 5,
      });
      const highAmbition = createPersonality({
        professionalism: 5, determination: 5, temperament: 5, loyalty: 5, ambition: 8,
      });

      const scoreLow = calculatePersonalityCompatibility(lowAmbition, lowAmbition);
      const scoreHigh = calculatePersonalityCompatibility(highAmbition, highAmbition);

      expect(scoreHigh).toBeLessThan(scoreLow);
    });

    it('결과가 -10 ~ +10 범위 내여야 한다', () => {
      // 극단적 케이스
      const worst = createPersonality({
        professionalism: 1, determination: 1, temperament: 1, loyalty: 1, ambition: 10,
      });
      const best = createPersonality({
        professionalism: 10, determination: 10, temperament: 10, loyalty: 10, ambition: 10,
      });
      const score = calculatePersonalityCompatibility(worst, best);
      expect(score).toBeGreaterThanOrEqual(-10);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('최고 호환 조합이 +10을 초과하지 않아야 한다', () => {
      const ideal = createPersonality({
        professionalism: 7, determination: 7, temperament: 8, loyalty: 8, ambition: 3,
      });
      const score = calculatePersonalityCompatibility(ideal, ideal);
      expect(score).toBeLessThanOrEqual(10);
    });
  });
});
