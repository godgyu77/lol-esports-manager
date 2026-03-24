import { describe, it, expect } from 'vitest';
import {
  FACTOR_WEIGHTS,
  COMPLAINT_THRESHOLD,
  createDefaultSatisfaction,
} from './playerSatisfactionEngine';
import type { SatisfactionFactors } from './playerSatisfactionEngine';

describe('playerSatisfactionEngine', () => {
  describe('FACTOR_WEIGHTS', () => {
    it('가중치 합이 1.0이어야 한다', () => {
      const sum = Object.values(FACTOR_WEIGHTS).reduce((acc, w) => acc + w, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    });

    it('모든 SatisfactionFactors 키에 대해 가중치가 존재해야 한다', () => {
      const expectedKeys: (keyof SatisfactionFactors)[] = [
        'playtime',
        'salary',
        'teamPerformance',
        'personalPerformance',
        'roleClarity',
        'teamChemistry',
      ];
      for (const key of expectedKeys) {
        expect(FACTOR_WEIGHTS).toHaveProperty(key);
        expect(FACTOR_WEIGHTS[key]).toBeGreaterThan(0);
      }
    });

    it('각 가중치는 0보다 크고 1보다 작아야 한다', () => {
      for (const [key, value] of Object.entries(FACTOR_WEIGHTS)) {
        expect(value, `${key} 가중치가 범위 밖`).toBeGreaterThan(0);
        expect(value, `${key} 가중치가 범위 밖`).toBeLessThan(1);
      }
    });
  });

  describe('COMPLAINT_THRESHOLD', () => {
    it('불만 임계값이 30이어야 한다', () => {
      expect(COMPLAINT_THRESHOLD).toBe(30);
    });

    it('불만 임계값이 0과 100 사이여야 한다', () => {
      expect(COMPLAINT_THRESHOLD).toBeGreaterThanOrEqual(0);
      expect(COMPLAINT_THRESHOLD).toBeLessThanOrEqual(100);
    });
  });

  describe('createDefaultSatisfaction', () => {
    it('기본 만족도가 50이어야 한다', () => {
      const result = createDefaultSatisfaction('player-1');
      expect(result.overallSatisfaction).toBe(50);
    });

    it('모든 요소의 기본값이 50이어야 한다', () => {
      const result = createDefaultSatisfaction('player-1');
      expect(result.factors.playtime).toBe(50);
      expect(result.factors.salary).toBe(50);
      expect(result.factors.teamPerformance).toBe(50);
      expect(result.factors.personalPerformance).toBe(50);
      expect(result.factors.roleClarity).toBe(50);
      expect(result.factors.teamChemistry).toBe(50);
    });

    it('전달된 playerId가 올바르게 설정되어야 한다', () => {
      const result = createDefaultSatisfaction('test-player-abc');
      expect(result.playerId).toBe('test-player-abc');
    });

    it('서로 다른 playerId로 호출하면 독립적인 결과를 반환해야 한다', () => {
      const result1 = createDefaultSatisfaction('player-1');
      const result2 = createDefaultSatisfaction('player-2');
      expect(result1.playerId).not.toBe(result2.playerId);
      expect(result1.overallSatisfaction).toBe(result2.overallSatisfaction);
    });
  });
});
