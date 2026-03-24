/**
 * transferEngine 단위 테스트
 * - 순수 함수 (calculatePlayerValue, calculateFairSalary)만 테스트
 * - DB 의존 함수는 제외
 */

import { describe, it, expect } from 'vitest';
import { calculatePlayerValue, calculateFairSalary } from './transferEngine';
import type { Player } from '../../types/player';

// ─────────────────────────────────────────
// 헬퍼: mock 선수 생성
// ─────────────────────────────────────────

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  const defaults: Player = {
    id: 'test_player',
    name: 'Test Player',
    teamId: 'team_test',
    position: 'mid',
    age: 22,
    nationality: 'KR',
    stats: {
      mechanical: 70,
      gameSense: 70,
      teamwork: 70,
      consistency: 70,
      laning: 70,
      aggression: 70,
    },
    mental: {
      mental: 70,
      stamina: 80,
      morale: 70,
    },
    contract: {
      salary: 3000,
      contractEndSeason: 5,
    },
    championPool: [
      { championId: 'champ1', proficiency: 80, gamesPlayed: 50 },
    ],
    potential: 70,
    peakAge: 23,
    popularity: 50,
    secondaryPosition: null,
    playstyle: 'versatile',
    careerGames: 0,
    chemistry: {},
    formHistory: [],
  };

  return {
    ...defaults,
    ...overrides,
    stats: { ...defaults.stats, ...(overrides.stats ?? {}) },
    mental: { ...defaults.mental, ...(overrides.mental ?? {}) },
    contract: { ...defaults.contract, ...(overrides.contract ?? {}) },
  };
}

// ─────────────────────────────────────────
// calculatePlayerValue 테스트
// ─────────────────────────────────────────

describe('calculatePlayerValue', () => {
  it('OVR이 높은 선수가 더 높은 가치', () => {
    const highOvr = createMockPlayer({
      stats: {
        mechanical: 90, gameSense: 90, teamwork: 90,
        consistency: 90, laning: 90, aggression: 90,
      },
    });
    const lowOvr = createMockPlayer({
      stats: {
        mechanical: 50, gameSense: 50, teamwork: 50,
        consistency: 50, laning: 50, aggression: 50,
      },
    });

    expect(calculatePlayerValue(highOvr)).toBeGreaterThan(calculatePlayerValue(lowOvr));
  });

  it('젊은 선수(18~22)가 나이든 선수(28+)보다 높은 가치', () => {
    const youngPlayer = createMockPlayer({ age: 20 });
    const oldPlayer = createMockPlayer({ age: 28 });

    expect(calculatePlayerValue(youngPlayer)).toBeGreaterThan(calculatePlayerValue(oldPlayer));
  });

  it('potential이 높을수록 가치 상승', () => {
    const highPotential = createMockPlayer({ potential: 95 });
    const lowPotential = createMockPlayer({ potential: 30 });

    expect(calculatePlayerValue(highPotential)).toBeGreaterThan(calculatePlayerValue(lowPotential));
  });

  it('가치는 항상 최소값(500) 이상', () => {
    // 스탯 최저, 나이 최고, 잠재력 최저
    const worstPlayer = createMockPlayer({
      stats: {
        mechanical: 1, gameSense: 1, teamwork: 1,
        consistency: 1, laning: 1, aggression: 1,
      },
      age: 30,
      potential: 0,
      popularity: 0,
    });

    expect(calculatePlayerValue(worstPlayer)).toBeGreaterThanOrEqual(500);
  });
});

// ─────────────────────────────────────────
// calculateFairSalary 테스트
// ─────────────────────────────────────────

describe('calculateFairSalary', () => {
  it('OVR이 높은 선수의 연봉이 더 높음', () => {
    const highOvr = createMockPlayer({
      stats: {
        mechanical: 90, gameSense: 90, teamwork: 90,
        consistency: 90, laning: 90, aggression: 90,
      },
    });
    const lowOvr = createMockPlayer({
      stats: {
        mechanical: 50, gameSense: 50, teamwork: 50,
        consistency: 50, laning: 50, aggression: 50,
      },
    });

    expect(calculateFairSalary(highOvr)).toBeGreaterThan(calculateFairSalary(lowOvr));
  });

  it('연봉은 항상 최소값(300) 이상', () => {
    const worstPlayer = createMockPlayer({
      stats: {
        mechanical: 1, gameSense: 1, teamwork: 1,
        consistency: 1, laning: 1, aggression: 1,
      },
      age: 30,
    });

    expect(calculateFairSalary(worstPlayer)).toBeGreaterThanOrEqual(300);
  });
});
