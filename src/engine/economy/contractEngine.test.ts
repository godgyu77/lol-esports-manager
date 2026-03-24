/**
 * contractEngine 단위 테스트
 * - 순수 함수 (calculateRenewalOffer, evaluatePlayerDemand)만 테스트
 * - DB 의존 함수 (attemptRenewal, getTeamExpiringContracts)는 제외
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRenewalOffer,
  evaluatePlayerDemand,
  generateDecisionFactors,
  evaluateTeam,
  generatePlayerCounterOffer,
} from './contractEngine';
import type { Player } from '../../types/player';
import type { ContractDecisionFactors } from '../../types/contract';

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
// calculateRenewalOffer 테스트
// ─────────────────────────────────────────

describe('calculateRenewalOffer', () => {
  it('젊고 잠재력 높은 선수에게 2년 계약 제안 (장기 락인 방지)', () => {
    const youngTalent = createMockPlayer({ age: 20, potential: 85 });
    const offer = calculateRenewalOffer(youngTalent);

    expect(offer.suggestedYears).toBe(2);
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

// ─────────────────────────────────────────
// generateDecisionFactors 테스트
// ─────────────────────────────────────────

describe('generateDecisionFactors', () => {
  it('신인 선수(20세 이하)는 출전 기회를 가장 중시', () => {
    const rookie = createMockPlayer({ age: 18 });
    const factors = generateDecisionFactors(rookie);

    expect(factors.playtime).toBeGreaterThan(factors.money);
    expect(factors.playtime).toBeGreaterThan(factors.loyalty);
  });

  it('베테랑(27세 이상)은 우승을 가장 중시', () => {
    const veteran = createMockPlayer({ age: 28 });
    const factors = generateDecisionFactors(veteran);

    expect(factors.winning).toBeGreaterThanOrEqual(factors.money);
    expect(factors.winning).toBeGreaterThan(factors.playtime);
  });

  it('스타급(OVR 80+)은 돈과 명성을 중시', () => {
    const star = createMockPlayer({
      age: 24,
      stats: {
        mechanical: 85, gameSense: 85, teamwork: 85,
        consistency: 85, laning: 85, aggression: 85,
      },
    });
    const factors = generateDecisionFactors(star);

    expect(factors.money).toBeGreaterThan(50);
    expect(factors.reputation).toBeGreaterThan(50);
  });

  it('하위 선수(OVR 60 미만)는 출전 기회 절실', () => {
    const low = createMockPlayer({
      stats: {
        mechanical: 50, gameSense: 50, teamwork: 50,
        consistency: 50, laning: 50, aggression: 50,
      },
    });
    const factors = generateDecisionFactors(low);

    expect(factors.playtime).toBeGreaterThan(factors.reputation);
  });

  it('모든 팩터는 0~100 범위', () => {
    const player = createMockPlayer();
    const factors = generateDecisionFactors(player);

    for (const key of ['money', 'winning', 'playtime', 'loyalty', 'reputation'] as const) {
      expect(factors[key]).toBeGreaterThanOrEqual(0);
      expect(factors[key]).toBeLessThanOrEqual(100);
    }
  });
});

// ─────────────────────────────────────────
// evaluateTeam 테스트
// ─────────────────────────────────────────

describe('evaluateTeam', () => {
  const defaultFactors: ContractDecisionFactors = {
    money: 50, winning: 50, playtime: 50, loyalty: 50, reputation: 50,
  };

  const strongTeam = {
    reputation: 85,
    recentWinRate: 0.75,
    rosterStrength: 78,
    isCurrentTeam: true,
    positionCompetitorOvr: 60,
  };

  const weakTeam = {
    reputation: 30,
    recentWinRate: 0.3,
    rosterStrength: 55,
    isCurrentTeam: false,
    positionCompetitorOvr: 72,
  };

  it('명문팀 + 높은 연봉 → 높은 평가', () => {
    const player = createMockPlayer();
    const eval1 = evaluateTeam(player, defaultFactors, strongTeam, 5000);

    expect(eval1.overall).toBeGreaterThan(60);
  });

  it('약한 팀 + 낮은 연봉 → 낮은 평가', () => {
    const player = createMockPlayer();
    const eval2 = evaluateTeam(player, defaultFactors, weakTeam, 1000);

    expect(eval2.overall).toBeLessThan(50);
  });

  it('같은 팀에서 충성도 보너스 적용', () => {
    const player = createMockPlayer();
    const currentTeamEval = evaluateTeam(player, defaultFactors, { ...weakTeam, isCurrentTeam: true }, 3000);
    const newTeamEval = evaluateTeam(player, defaultFactors, { ...weakTeam, isCurrentTeam: false }, 3000);

    expect(currentTeamEval.loyaltyScore).toBeGreaterThan(newTeamEval.loyaltyScore);
  });

  it('돈 중시 선수는 연봉에 민감', () => {
    const moneyFactors: ContractDecisionFactors = { money: 90, winning: 20, playtime: 20, loyalty: 20, reputation: 20 };
    const player = createMockPlayer();

    const highSalary = evaluateTeam(player, moneyFactors, strongTeam, 8000);
    const lowSalary = evaluateTeam(player, moneyFactors, strongTeam, 1000);

    expect(highSalary.overall).toBeGreaterThan(lowSalary.overall);
  });

  it('reasons 배열이 비어있지 않음', () => {
    const player = createMockPlayer();
    const evaluation = evaluateTeam(player, defaultFactors, strongTeam, 3000);

    expect(evaluation.reasons.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────
// generatePlayerCounterOffer 테스트
// ─────────────────────────────────────────

describe('generatePlayerCounterOffer', () => {
  it('팀 평가 낮으면 더 높은 연봉 요구', () => {
    const player = createMockPlayer();
    const factors = generateDecisionFactors(player);

    const goodEval = { overall: 85, salaryScore: 80, winningScore: 80, playtimeScore: 80, loyaltyScore: 80, reputationScore: 80, reasons: [] };
    const badEval = { overall: 25, salaryScore: 20, winningScore: 20, playtimeScore: 20, loyaltyScore: 20, reputationScore: 20, reasons: [] };

    const goodCounter = generatePlayerCounterOffer(player, factors, { salary: 3000, years: 2, signingBonus: 0 }, goodEval);
    const badCounter = generatePlayerCounterOffer(player, factors, { salary: 3000, years: 2, signingBonus: 0 }, badEval);

    expect(badCounter.salary).toBeGreaterThanOrEqual(goodCounter.salary);
  });

  it('베테랑은 1년 계약 선호', () => {
    const veteran = createMockPlayer({ age: 28 });
    const factors = generateDecisionFactors(veteran);
    const eval1 = { overall: 60, salaryScore: 60, winningScore: 60, playtimeScore: 60, loyaltyScore: 60, reputationScore: 60, reasons: [] };

    const counter = generatePlayerCounterOffer(veteran, factors, { salary: 3000, years: 3, signingBonus: 0 }, eval1);

    expect(counter.years).toBe(1);
  });

  it('역제안 연봉은 팀 제안 이상', () => {
    const player = createMockPlayer();
    const factors = generateDecisionFactors(player);
    const eval1 = { overall: 50, salaryScore: 50, winningScore: 50, playtimeScore: 50, loyaltyScore: 50, reputationScore: 50, reasons: [] };

    const counter = generatePlayerCounterOffer(player, factors, { salary: 5000, years: 2, signingBonus: 0 }, eval1);

    expect(counter.salary).toBeGreaterThanOrEqual(5000);
  });

  it('메시지가 항상 존재', () => {
    const player = createMockPlayer();
    const factors = generateDecisionFactors(player);
    const eval1 = { overall: 50, salaryScore: 50, winningScore: 50, playtimeScore: 50, loyaltyScore: 50, reputationScore: 50, reasons: [] };

    const counter = generatePlayerCounterOffer(player, factors, { salary: 3000, years: 2, signingBonus: 0 }, eval1);

    expect(counter.message).toBeTruthy();
    expect(counter.message.length).toBeGreaterThan(0);
  });
});
