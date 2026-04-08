/**
 * playerGrowth 단위 테스트
 * - 순수 함수 (calculateGrowth, calculateTeamGrowth)만 테스트
 * - DB 의존 없음, 결정론적 RNG 기반
 */

import { describe, it, expect } from 'vitest';
import { calculateGrowth, calculateTeamGrowth } from './playerGrowth';
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
    careerGames: 100,
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
// calculateGrowth 테스트
// ─────────────────────────────────────────

describe('calculateGrowth', () => {
  it('성장기 선수(mid, 19세)는 phase가 growing', () => {
    const young = createMockPlayer({ age: 19, position: 'mid' });
    const result = calculateGrowth(young, 'seed_1');

    expect(result.phase).toBe('growing');
  });

  it('피크기 선수(mid, 23세)는 phase가 peak', () => {
    const peakPlayer = createMockPlayer({ age: 23, position: 'mid' });
    const result = calculateGrowth(peakPlayer, 'seed_1');

    expect(result.phase).toBe('peak');
  });

  it('하락기 선수(mid, 27세)는 phase가 declining', () => {
    const old = createMockPlayer({ age: 27, position: 'mid' });
    const result = calculateGrowth(old, 'seed_1');

    expect(result.phase).toBe('declining');
  });

  it('서포트 포지션은 피크 범위가 다름 (23~28)', () => {
    const supportPeak = createMockPlayer({ age: 26, position: 'support' });
    const result = calculateGrowth(supportPeak, 'seed_1');

    expect(result.phase).toBe('peak');
  });

  it('동일 seed에서 동일 결과 (결정론적)', () => {
    const player = createMockPlayer();
    const r1 = calculateGrowth(player, 'same_seed');
    const r2 = calculateGrowth(player, 'same_seed');

    expect(r1.newStats).toEqual(r2.newStats);
  });

  it('다른 seed에서 다른 결과', () => {
    const player = createMockPlayer();
    const r1 = calculateGrowth(player, 'seed_a');
    const r2 = calculateGrowth(player, 'seed_b');

    // 모든 스탯이 동일할 확률은 극히 낮음
    const allSame = Object.keys(r1.changes).every(
      key => r1.changes[key as keyof typeof r1.changes] === r2.changes[key as keyof typeof r2.changes],
    );
    expect(allSame).toBe(false);
  });

  it('성장기 선수는 스탯이 대체로 증가', () => {
    const young = createMockPlayer({ age: 18, position: 'mid', potential: 85 });
    // 여러 seed로 테스트하여 평균 확인
    let totalChange = 0;
    for (let i = 0; i < 20; i++) {
      const result = calculateGrowth(young, `growth_seed_${i}`);
      totalChange += Object.values(result.changes).reduce((s, v) => s + v, 0);
    }
    expect(totalChange / 20).toBeGreaterThan(0);
  });

  it('하락기 선수는 스탯이 대체로 감소', () => {
    const old = createMockPlayer({ age: 30, position: 'mid' });
    let totalChange = 0;
    for (let i = 0; i < 20; i++) {
      const result = calculateGrowth(old, `decline_seed_${i}`);
      totalChange += Object.values(result.changes).reduce((s, v) => s + v, 0);
    }
    expect(totalChange / 20).toBeLessThan(0);
  });

  it('스탯은 30~99 범위 내로 클램프됨', () => {
    const extremePlayer = createMockPlayer({
      age: 30,
      stats: {
        mechanical: 31, gameSense: 31, teamwork: 31,
        consistency: 31, laning: 31, aggression: 31,
      },
    });
    const result = calculateGrowth(extremePlayer, 'clamp_test');

    for (const val of Object.values(result.newStats)) {
      expect(val).toBeGreaterThanOrEqual(30);
      expect(val).toBeLessThanOrEqual(99);
    }
  });

  it('고잠재력(81+) 성장기 선수는 더 빠르게 성장', () => {
    const highPot = createMockPlayer({ age: 18, position: 'mid', potential: 90 });
    const lowPot = createMockPlayer({ age: 18, position: 'mid', potential: 50, id: 'low_pot' });

    let highTotal = 0;
    let lowTotal = 0;
    for (let i = 0; i < 30; i++) {
      const h = calculateGrowth(highPot, `pot_seed_${i}`);
      const l = calculateGrowth(lowPot, `pot_seed_${i}`);
      highTotal += Object.values(h.changes).reduce((s, v) => s + v, 0);
      lowTotal += Object.values(l.changes).reduce((s, v) => s + v, 0);
    }
    expect(highTotal / 30).toBeGreaterThan(lowTotal / 30);
  });

  it('높은 폼(80)은 낮은 폼(20)보다 성장에 유리', () => {
    const player = createMockPlayer({ age: 20, position: 'mid' });
    let highFormTotal = 0;
    let lowFormTotal = 0;

    for (let i = 0; i < 30; i++) {
      const hf = calculateGrowth(player, `form_seed_${i}`, 80);
      const lf = calculateGrowth(player, `form_seed_${i}`, 20);
      highFormTotal += Object.values(hf.changes).reduce((s, v) => s + v, 0);
      lowFormTotal += Object.values(lf.changes).reduce((s, v) => s + v, 0);
    }
    expect(highFormTotal / 30).toBeGreaterThan(lowFormTotal / 30);
  });

  it('출전 20+ 경기 선수는 5 미만보다 성장률 높음', () => {
    const player = createMockPlayer({ age: 20, position: 'mid' });
    let activeTotal = 0;
    let benchTotal = 0;

    for (let i = 0; i < 30; i++) {
      const active = calculateGrowth(player, `play_seed_${i}`, 50, { gamesPlayedThisSplit: 25 });
      const bench = calculateGrowth(player, `play_seed_${i}`, 50, { gamesPlayedThisSplit: 2 });
      activeTotal += Object.values(active.changes).reduce((s, v) => s + v, 0);
      benchTotal += Object.values(bench.changes).reduce((s, v) => s + v, 0);
    }
    expect(activeTotal / 30).toBeGreaterThan(benchTotal / 30);
  });

  it('감독 능력치 75 + 매칭 철학은 성장 보너스 제공', () => {
    const player = createMockPlayer({ age: 20, position: 'mid', playstyle: 'versatile' });
    let boostedTotal = 0;
    let baseTotal = 0;

    for (let i = 0; i < 30; i++) {
      const boosted = calculateGrowth(player, `coach_seed_${i}`, 50, {
        headCoachAbility: 80,
        coachingPhilosophy: 'balanced', // versatile과 매칭
      });
      const base = calculateGrowth(player, `coach_seed_${i}`, 50, {});
      boostedTotal += Object.values(boosted.changes).reduce((s, v) => s + v, 0);
      baseTotal += Object.values(base.changes).reduce((s, v) => s + v, 0);
    }
    expect(boostedTotal / 30).toBeGreaterThan(baseTotal / 30);
  });

  it('하락기 고일관성(80+) 선수는 저일관성보다 느리게 하락', () => {
    const highCon = createMockPlayer({
      age: 30, position: 'mid',
      stats: { mechanical: 70, gameSense: 70, teamwork: 70, consistency: 85, laning: 70, aggression: 70 },
    });
    const lowCon = createMockPlayer({
      age: 30, position: 'mid', id: 'low_con',
      stats: { mechanical: 70, gameSense: 70, teamwork: 70, consistency: 40, laning: 70, aggression: 70 },
    });

    let highConTotal = 0;
    let lowConTotal = 0;
    for (let i = 0; i < 30; i++) {
      const hc = calculateGrowth(highCon, `con_seed_${i}`);
      const lc = calculateGrowth(lowCon, `con_seed_${i}`);
      highConTotal += Object.values(hc.changes).reduce((s, v) => s + v, 0);
      lowConTotal += Object.values(lc.changes).reduce((s, v) => s + v, 0);
    }
    // 하락량이 더 적다 = 더 높은 total (음수가 더 작다)
    expect(highConTotal / 30).toBeGreaterThan(lowConTotal / 30);
  });

  it('oldStats은 원본 스탯과 동일, newStats은 변경됨', () => {
    const player = createMockPlayer();
    const result = calculateGrowth(player, 'check_stats');

    expect(result.oldStats).toEqual(player.stats);
    expect(result.playerId).toBe(player.id);
  });
  it('prospect traits give a modest growth boost', () => {
    const prospect = createMockPlayer({ age: 19, traits: ['GROWTH_POTENTIAL', 'SPONGE'] });
    const base = createMockPlayer({ age: 19, id: 'base_player', traits: [] });

    let prospectTotal = 0;
    let baseTotal = 0;
    for (let i = 0; i < 20; i++) {
      const boosted = calculateGrowth(prospect, `trait_growth_${i}`);
      const regular = calculateGrowth(base, `trait_growth_${i}`);
      prospectTotal += Object.values(boosted.changes).reduce((sum, value) => sum + value, 0);
      baseTotal += Object.values(regular.changes).reduce((sum, value) => sum + value, 0);
    }

    expect(prospectTotal / 20).toBeGreaterThan(baseTotal / 20);
  });
});

// ─────────────────────────────────────────
// calculateTeamGrowth 테스트
// ─────────────────────────────────────────

describe('calculateTeamGrowth', () => {
  it('팀 선수 수만큼 결과를 반환', () => {
    const players = [
      createMockPlayer({ id: 'p1', position: 'top' }),
      createMockPlayer({ id: 'p2', position: 'jungle' }),
      createMockPlayer({ id: 'p3', position: 'mid' }),
    ];
    const results = calculateTeamGrowth(players, 'team_seed');

    expect(results).toHaveLength(3);
    expect(results[0].playerId).toBe('p1');
    expect(results[1].playerId).toBe('p2');
    expect(results[2].playerId).toBe('p3');
  });

  it('선수별 개별 폼 평균과 출전 수 적용', () => {
    const players = [
      createMockPlayer({ id: 'p1', age: 20, position: 'mid' }),
      createMockPlayer({ id: 'p2', age: 20, position: 'mid' }),
    ];

    const results = calculateTeamGrowth(
      players,
      'team_seed',
      { p1: 80, p2: 20 },
      { p1: 25, p2: 2 },
    );

    // p1 (높은 폼 + 많은 출전)이 p2보다 성장량이 더 높아야 함
    const p1Total = Object.values(results[0].changes).reduce((s, v) => s + v, 0);
    const p2Total = Object.values(results[1].changes).reduce((s, v) => s + v, 0);
    expect(p1Total).toBeGreaterThan(p2Total);
  });

  it('빈 배열에 대해 빈 결과 반환', () => {
    const results = calculateTeamGrowth([], 'empty_seed');
    expect(results).toHaveLength(0);
  });
});
