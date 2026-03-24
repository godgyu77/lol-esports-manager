import { describe, it, expect } from 'vitest';
import {
  initializeSoloRank,
  expectedTierByOvr,
  TIER_LP_THRESHOLDS,
} from './soloRankEngine';
import type { SoloRankTier } from '../../types/soloRank';

describe('soloRankEngine', () => {
  describe('expectedTierByOvr', () => {
    it('OVR 85+ 이면 challenger를 반환해야 한다', () => {
      expect(expectedTierByOvr(85)).toBe('challenger');
      expect(expectedTierByOvr(90)).toBe('challenger');
      expect(expectedTierByOvr(99)).toBe('challenger');
    });

    it('OVR 78-84 이면 grandmaster를 반환해야 한다', () => {
      expect(expectedTierByOvr(78)).toBe('grandmaster');
      expect(expectedTierByOvr(84)).toBe('grandmaster');
    });

    it('OVR 70-77 이면 master를 반환해야 한다', () => {
      expect(expectedTierByOvr(70)).toBe('master');
      expect(expectedTierByOvr(77)).toBe('master');
    });

    it('OVR 62-69 이면 diamond를 반환해야 한다', () => {
      expect(expectedTierByOvr(62)).toBe('diamond');
      expect(expectedTierByOvr(69)).toBe('diamond');
    });

    it('OVR 55-61 이면 emerald를 반환해야 한다', () => {
      expect(expectedTierByOvr(55)).toBe('emerald');
      expect(expectedTierByOvr(61)).toBe('emerald');
    });

    it('OVR 54 이하면 platinum을 반환해야 한다', () => {
      expect(expectedTierByOvr(54)).toBe('platinum');
      expect(expectedTierByOvr(30)).toBe('platinum');
    });
  });

  describe('TIER_LP_THRESHOLDS', () => {
    it('모든 티어에 대해 LP 범위가 존재해야 한다', () => {
      const tiers: SoloRankTier[] = [
        'challenger', 'grandmaster', 'master', 'diamond', 'emerald', 'platinum',
      ];
      for (const tier of tiers) {
        expect(TIER_LP_THRESHOLDS).toHaveProperty(tier);
        expect(TIER_LP_THRESHOLDS[tier].min).toBeDefined();
        expect(TIER_LP_THRESHOLDS[tier].max).toBeDefined();
      }
    });

    it('각 티어의 min이 max보다 작거나 같아야 한다', () => {
      for (const [tier, range] of Object.entries(TIER_LP_THRESHOLDS)) {
        expect(range.min, `${tier}: min > max`).toBeLessThanOrEqual(range.max);
      }
    });

    it('상위 티어의 LP min이 하위 티어의 LP max보다 커야 한다', () => {
      expect(TIER_LP_THRESHOLDS.challenger.min).toBeGreaterThan(TIER_LP_THRESHOLDS.grandmaster.max);
      expect(TIER_LP_THRESHOLDS.grandmaster.min).toBeGreaterThan(TIER_LP_THRESHOLDS.master.max);
      expect(TIER_LP_THRESHOLDS.master.min).toBeGreaterThan(TIER_LP_THRESHOLDS.diamond.max);
      expect(TIER_LP_THRESHOLDS.diamond.min).toBeGreaterThan(TIER_LP_THRESHOLDS.emerald.max);
      expect(TIER_LP_THRESHOLDS.emerald.min).toBeGreaterThan(TIER_LP_THRESHOLDS.platinum.max);
    });

    it('platinum의 min은 0이어야 한다', () => {
      expect(TIER_LP_THRESHOLDS.platinum.min).toBe(0);
    });
  });

  describe('initializeSoloRank', () => {
    it('OVR 85+ 선수는 challenger 티어로 초기화되어야 한다', () => {
      const result = initializeSoloRank('player-1', 90);
      expect(result.tier).toBe('challenger');
    });

    it('OVR 78 선수는 grandmaster 티어로 초기화되어야 한다', () => {
      const result = initializeSoloRank('player-2', 78);
      expect(result.tier).toBe('grandmaster');
    });

    it('초기 LP가 해당 티어의 범위 내에 있어야 한다', () => {
      const result = initializeSoloRank('player-3', 75);
      const range = TIER_LP_THRESHOLDS[result.tier];
      expect(result.lp).toBeGreaterThanOrEqual(range.min);
      expect(result.lp).toBeLessThanOrEqual(range.max);
    });

    it('playerId가 올바르게 설정되어야 한다', () => {
      const result = initializeSoloRank('test-player', 80);
      expect(result.playerId).toBe('test-player');
    });

    it('gamesPlayedToday가 0으로 초기화되어야 한다', () => {
      const result = initializeSoloRank('player-4', 70);
      expect(result.gamesPlayedToday).toBe(0);
    });

    it('recentWinRate가 0과 1 사이여야 한다', () => {
      const result = initializeSoloRank('player-5', 80);
      expect(result.recentWinRate).toBeGreaterThan(0);
      expect(result.recentWinRate).toBeLessThanOrEqual(1);
    });

    it('rank가 1 이상이어야 한다', () => {
      const result = initializeSoloRank('player-6', 85);
      expect(result.rank).toBeGreaterThanOrEqual(1);
    });
  });
});
