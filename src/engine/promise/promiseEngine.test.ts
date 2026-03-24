import { describe, it, expect } from 'vitest';
import { PROMISE_PENALTIES, PROMISE_REWARDS } from './promiseEngine';
import type { PromiseType } from '../../types/promise';

const ALL_PROMISE_TYPES: PromiseType[] = [
  'starter_guarantee',
  'no_transfer',
  'salary_raise',
  'playtime',
  'new_signing',
  'championship_goal',
  'playoff_goal',
  'transfer_allow',
];

describe('promiseEngine', () => {
  describe('PROMISE_PENALTIES', () => {
    it('모든 PromiseType에 대해 페널티가 존재해야 한다', () => {
      for (const type of ALL_PROMISE_TYPES) {
        expect(PROMISE_PENALTIES, `${type}에 대한 페널티 누락`).toHaveProperty(type);
      }
    });

    it('각 페널티에 morale과 trust 필드가 있어야 한다', () => {
      for (const type of ALL_PROMISE_TYPES) {
        const penalty = PROMISE_PENALTIES[type];
        expect(penalty).toHaveProperty('morale');
        expect(penalty).toHaveProperty('trust');
      }
    });

    it('morale 페널티는 음수여야 한다', () => {
      for (const type of ALL_PROMISE_TYPES) {
        expect(
          PROMISE_PENALTIES[type].morale,
          `${type}: morale 페널티가 음수가 아님`,
        ).toBeLessThan(0);
      }
    });

    it('trust 페널티는 양수여야 한다 (신뢰 감소량)', () => {
      for (const type of ALL_PROMISE_TYPES) {
        expect(
          PROMISE_PENALTIES[type].trust,
          `${type}: trust 페널티가 양수가 아님`,
        ).toBeGreaterThan(0);
      }
    });

    it('transfer_allow의 morale 페널티가 가장 커야 한다', () => {
      const transferPenalty = Math.abs(PROMISE_PENALTIES.transfer_allow.morale);
      for (const type of ALL_PROMISE_TYPES) {
        expect(transferPenalty).toBeGreaterThanOrEqual(
          Math.abs(PROMISE_PENALTIES[type].morale),
        );
      }
    });
  });

  describe('PROMISE_REWARDS', () => {
    it('모든 PromiseType에 대해 보상이 존재해야 한다', () => {
      for (const type of ALL_PROMISE_TYPES) {
        expect(PROMISE_REWARDS, `${type}에 대한 보상 누락`).toHaveProperty(type);
      }
    });

    it('각 보상에 morale 필드가 있어야 한다', () => {
      for (const type of ALL_PROMISE_TYPES) {
        expect(PROMISE_REWARDS[type]).toHaveProperty('morale');
      }
    });

    it('morale 보상은 양수여야 한다', () => {
      for (const type of ALL_PROMISE_TYPES) {
        expect(
          PROMISE_REWARDS[type].morale,
          `${type}: morale 보상이 양수가 아님`,
        ).toBeGreaterThan(0);
      }
    });

    it('championship_goal의 morale 보상이 가장 커야 한다', () => {
      const champReward = PROMISE_REWARDS.championship_goal.morale;
      for (const type of ALL_PROMISE_TYPES) {
        expect(champReward).toBeGreaterThanOrEqual(PROMISE_REWARDS[type].morale);
      }
    });

    it('PENALTIES와 REWARDS의 키 집합이 동일해야 한다', () => {
      const penaltyKeys = Object.keys(PROMISE_PENALTIES).sort();
      const rewardKeys = Object.keys(PROMISE_REWARDS).sort();
      expect(penaltyKeys).toEqual(rewardKeys);
    });
  });
});
