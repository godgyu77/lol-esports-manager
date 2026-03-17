/**
 * contractEngine 단위 테스트
 * - 순수 함수 (calculateRenewalOffer, evaluatePlayerDemand)만 테스트
 * - DB 의존 함수 (attemptRenewal, getTeamExpiringContracts)는 제외
 */

import { describe, it, expect } from 'vitest';
import { calculateRenewalOffer, evaluatePlayerDemand } from './contractEngine';
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
// calculateRenewalOffer 테스트
// ─────────────────────────────────────────

describe('calculateRenewalOffer', () => {
  it('젊고 잠재력 높은 선수에게 3년 계약 제안', () => {
    const youngTalent = createMockPlayer({ age: 20, potential: 85 });
    const offer = calculateRenewalOffer(youngTalent);

    expect(offer.suggestedYears).toBe(3);
  });

  it('나이 많은 선수(28+)에게 1년 계약 제안', () => {
    const oldPlayer = createMockPlayer({ age: 29, potential: 60 });
    const offer = calculateRenewalOffer(oldPlayer);

    expect(offer.suggestedYears).toBe(1);
  });

  it('잠재력 낮은 선수(40 미만)에게 1년 계약 제안', () => {
    const lowPotential = createMockPlayer({ age: 24, potential: 30 });
    const offer = calculateRenewalOffer(lowPotential);

    expect(offer.suggestedYears).toBe(1);
  });

  it('일반적인 선수(23~27세, potential 40~69)에게 2년 계약 제안', () => {
    const normalPlayer = createMockPlayer({ age: 25, potential: 55 });
    const offer = calculateRenewalOffer(normalPlayer);

    expect(offer.suggestedYears).toBe(2);
  });

  it('OVR 80+ 선수의 제안 연봉이 OVR 55 미만보다 높음', () => {
    const highOvr = createMockPlayer({
      stats: {
        mechanical: 85, gameSense: 85, teamwork: 85,
        consistency: 85, laning: 85, aggression: 85,
      },
    });
    const lowOvr = createMockPlayer({
      stats: {
        mechanical: 45, gameSense: 45, teamwork: 45,
        consistency: 45, laning: 45, aggression: 45,
      },
    });

    const highOffer = calculateRenewalOffer(highOvr);
    const lowOffer = calculateRenewalOffer(lowOvr);

    expect(highOffer.suggestedSalary).toBeGreaterThan(lowOffer.suggestedSalary);
  });

  it('제안 연봉은 양수', () => {
    const player = createMockPlayer();
    const offer = calculateRenewalOffer(player);

    expect(offer.suggestedSalary).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────
// evaluatePlayerDemand 테스트
// ─────────────────────────────────────────

describe('evaluatePlayerDemand', () => {
  it('요구 연봉 범위: minSalary < idealSalary < maxSalary', () => {
    const player = createMockPlayer();
    const demand = evaluatePlayerDemand(player);

    expect(demand.minSalary).toBeLessThan(demand.idealSalary);
    expect(demand.idealSalary).toBeLessThan(demand.maxSalary);
  });

  it('스타급(OVR 80+) 선수의 idealSalary가 일반 선수보다 높음', () => {
    const star = createMockPlayer({
      stats: {
        mechanical: 85, gameSense: 85, teamwork: 85,
        consistency: 85, laning: 85, aggression: 85,
      },
      contract: { salary: 5000, contractEndSeason: 5 },
    });
    const normal = createMockPlayer({
      stats: {
        mechanical: 65, gameSense: 65, teamwork: 65,
        consistency: 65, laning: 65, aggression: 65,
      },
      contract: { salary: 3000, contractEndSeason: 5 },
    });

    expect(evaluatePlayerDemand(star).idealSalary).toBeGreaterThan(
      evaluatePlayerDemand(normal).idealSalary,
    );
  });

  it('minSalary는 idealSalary의 80%', () => {
    const player = createMockPlayer();
    const demand = evaluatePlayerDemand(player);

    expect(demand.minSalary).toBe(Math.round(demand.idealSalary * 0.8));
  });

  it('maxSalary는 idealSalary의 120%', () => {
    const player = createMockPlayer();
    const demand = evaluatePlayerDemand(player);

    expect(demand.maxSalary).toBe(Math.round(demand.idealSalary * 1.2));
  });

  it('모든 요구 연봉은 양수', () => {
    const worstPlayer = createMockPlayer({
      stats: {
        mechanical: 1, gameSense: 1, teamwork: 1,
        consistency: 1, laning: 1, aggression: 1,
      },
      contract: { salary: 300, contractEndSeason: 5 },
    });
    const demand = evaluatePlayerDemand(worstPlayer);

    expect(demand.minSalary).toBeGreaterThan(0);
    expect(demand.idealSalary).toBeGreaterThan(0);
    expect(demand.maxSalary).toBeGreaterThan(0);
  });
});
