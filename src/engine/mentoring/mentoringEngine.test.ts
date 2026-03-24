import { describe, it, expect } from 'vitest';
import {
  getHighestStat,
  calculateMentorGrowthBonus,
  STAT_TO_COLUMN,
} from './mentoringEngine';
import type { Player } from '../../types/player';

function createMockPlayer(
  statsOverrides: Partial<Player['stats']> = {},
): Player {
  return {
    id: 'test-player',
    name: 'Test Player',
    teamId: 'team-1',
    position: 'mid',
    secondaryPosition: null,
    age: 22,
    nationality: 'KR',
    stats: {
      mechanical: 70,
      gameSense: 70,
      teamwork: 70,
      consistency: 70,
      laning: 70,
      aggression: 70,
      ...statsOverrides,
    },
    mental: { mental: 70, stamina: 80, morale: 80 },
    contract: { salary: 100000, contractEndSeason: 2 },
    championPool: [],
    potential: 80,
    peakAge: 24,
    popularity: 50,
    playstyle: 'versatile',
    careerGames: 100,
    chemistry: {},
    formHistory: [],
  };
}

describe('mentoringEngine', () => {
  describe('getHighestStat', () => {
    it('mechanical이 가장 높으면 mechanical을 반환해야 한다', () => {
      const player = createMockPlayer({ mechanical: 95 });
      expect(getHighestStat(player)).toBe('mechanical');
    });

    it('gameSense가 가장 높으면 gameSense를 반환해야 한다', () => {
      const player = createMockPlayer({ gameSense: 95 });
      expect(getHighestStat(player)).toBe('gameSense');
    });

    it('teamwork가 가장 높으면 teamwork를 반환해야 한다', () => {
      const player = createMockPlayer({ teamwork: 95 });
      expect(getHighestStat(player)).toBe('teamwork');
    });

    it('consistency가 가장 높으면 consistency를 반환해야 한다', () => {
      const player = createMockPlayer({ consistency: 95 });
      expect(getHighestStat(player)).toBe('consistency');
    });

    it('laning이 가장 높으면 laning을 반환해야 한다', () => {
      const player = createMockPlayer({ laning: 95 });
      expect(getHighestStat(player)).toBe('laning');
    });

    it('aggression이 가장 높으면 aggression을 반환해야 한다', () => {
      const player = createMockPlayer({ aggression: 95 });
      expect(getHighestStat(player)).toBe('aggression');
    });

    it('모든 스탯이 동일하면 첫 번째 스탯(mechanical)을 반환해야 한다', () => {
      const player = createMockPlayer();
      expect(getHighestStat(player)).toBe('mechanical');
    });
  });

  describe('calculateMentorGrowthBonus', () => {
    it('스탯 80+ 이면 0.15를 반환해야 한다', () => {
      expect(calculateMentorGrowthBonus(80)).toBe(0.15);
      expect(calculateMentorGrowthBonus(90)).toBe(0.15);
      expect(calculateMentorGrowthBonus(100)).toBe(0.15);
    });

    it('스탯 70-79 이면 0.10을 반환해야 한다', () => {
      expect(calculateMentorGrowthBonus(70)).toBe(0.10);
      expect(calculateMentorGrowthBonus(79)).toBe(0.10);
    });

    it('스탯 60-69 이면 0.05를 반환해야 한다', () => {
      expect(calculateMentorGrowthBonus(60)).toBe(0.05);
      expect(calculateMentorGrowthBonus(69)).toBe(0.05);
    });

    it('스탯 59 이하면 0.02를 반환해야 한다', () => {
      expect(calculateMentorGrowthBonus(59)).toBe(0.02);
      expect(calculateMentorGrowthBonus(30)).toBe(0.02);
      expect(calculateMentorGrowthBonus(0)).toBe(0.02);
    });

    it('경계값이 올바르게 동작해야 한다', () => {
      expect(calculateMentorGrowthBonus(80)).toBe(0.15);
      expect(calculateMentorGrowthBonus(79)).toBe(0.10);
      expect(calculateMentorGrowthBonus(70)).toBe(0.10);
      expect(calculateMentorGrowthBonus(69)).toBe(0.05);
      expect(calculateMentorGrowthBonus(60)).toBe(0.05);
      expect(calculateMentorGrowthBonus(59)).toBe(0.02);
    });
  });

  describe('STAT_TO_COLUMN', () => {
    it('6개 스탯 모두에 대한 매핑이 존재해야 한다', () => {
      const expectedStats = [
        'mechanical', 'gameSense', 'teamwork',
        'consistency', 'laning', 'aggression',
      ];
      for (const stat of expectedStats) {
        expect(STAT_TO_COLUMN, `${stat} 매핑 누락`).toHaveProperty(stat);
      }
    });

    it('gameSense는 game_sense로 매핑되어야 한다', () => {
      expect(STAT_TO_COLUMN.gameSense).toBe('game_sense');
    });

    it('camelCase가 아닌 스탯은 그대로 매핑되어야 한다', () => {
      expect(STAT_TO_COLUMN.mechanical).toBe('mechanical');
      expect(STAT_TO_COLUMN.teamwork).toBe('teamwork');
      expect(STAT_TO_COLUMN.consistency).toBe('consistency');
      expect(STAT_TO_COLUMN.laning).toBe('laning');
      expect(STAT_TO_COLUMN.aggression).toBe('aggression');
    });

    it('매핑 키 개수가 정확히 6개여야 한다', () => {
      expect(Object.keys(STAT_TO_COLUMN)).toHaveLength(6);
    });
  });
});
