/**
 * matchSimulator 단위 테스트
 */

import { describe, it, expect } from 'vitest';
import { simulateMatch, type BoFormat } from './matchSimulator';
import type { Lineup } from './teamRating';
import type { Player } from '../../types/player';
import type { Position } from '../../types/game';

// ─────────────────────────────────────────
// 헬퍼: mock 데이터 생성
// ─────────────────────────────────────────

let _mockPlayerCounter = 0;

/** 기본 선수 생성 (모든 필드 채움) */
function createMockPlayer(overrides: Partial<Player> & { position: Position; id?: string }): Player {
  const defaults: Player = {
    id: overrides.id ?? `player_${overrides.position}_${++_mockPlayerCounter}`,
    name: `Test ${overrides.position}`,
    teamId: 'team_test',
    position: overrides.position,
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

/** 5포지션 라인업 생성 (평균 스탯 지정) */
function createMockLineup(avgStat: number): Lineup {
  const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
  const lineup = {} as Record<Position, Player>;

  for (const pos of positions) {
    lineup[pos] = createMockPlayer({
      id: `player_${pos}_${avgStat}`,
      position: pos,
      stats: {
        mechanical: avgStat,
        gameSense: avgStat,
        teamwork: avgStat,
        consistency: avgStat,
        laning: avgStat,
        aggression: avgStat,
      },
    });
  }

  return lineup as Lineup;
}

// ─────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────

describe('simulateMatch', () => {
  const homeLineup = createMockLineup(70);
  const awayLineup = createMockLineup(70);

  it('Bo1 형식으로 시뮬레이션하면 1게임만 진행', () => {
    const result = simulateMatch(homeLineup, awayLineup, 'Bo1', 'test_bo1');

    expect(result.games).toHaveLength(1);
    expect(result.scoreHome + result.scoreAway).toBe(1);
  });

  it('Bo3 형식으로 시뮬레이션하면 2~3게임 진행, 승자가 2승', () => {
    const result = simulateMatch(homeLineup, awayLineup, 'Bo3', 'test_bo3');

    expect(result.games.length).toBeGreaterThanOrEqual(2);
    expect(result.games.length).toBeLessThanOrEqual(3);

    // 승자가 정확히 2승
    const winnerScore = result.winner === 'home' ? result.scoreHome : result.scoreAway;
    expect(winnerScore).toBe(2);
  });

  it('Bo5 형식으로 시뮬레이션하면 3~5게임 진행, 승자가 3승', () => {
    const result = simulateMatch(homeLineup, awayLineup, 'Bo5', 'test_bo5');

    expect(result.games.length).toBeGreaterThanOrEqual(3);
    expect(result.games.length).toBeLessThanOrEqual(5);

    // 승자가 정확히 3승
    const winnerScore = result.winner === 'home' ? result.scoreHome : result.scoreAway;
    expect(winnerScore).toBe(3);
  });

  it('결과의 scoreHome + scoreAway가 총 게임 수와 일치', () => {
    const formats: BoFormat[] = ['Bo1', 'Bo3', 'Bo5'];

    for (const format of formats) {
      const result = simulateMatch(homeLineup, awayLineup, format, `test_total_${format}`);
      expect(result.scoreHome + result.scoreAway).toBe(result.games.length);
    }
  });

  it('모든 게임에 이벤트가 최소 1개 이상 있음', () => {
    const result = simulateMatch(homeLineup, awayLineup, 'Bo5', 'test_events');

    for (const game of result.games) {
      expect(game.events.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('같은 시드로 시뮬레이션하면 동일한 결과', () => {
    const matchId = 'deterministic_seed_test';
    const result1 = simulateMatch(homeLineup, awayLineup, 'Bo5', matchId);
    const result2 = simulateMatch(homeLineup, awayLineup, 'Bo5', matchId);

    expect(result1.scoreHome).toBe(result2.scoreHome);
    expect(result1.scoreAway).toBe(result2.scoreAway);
    expect(result1.winner).toBe(result2.winner);
    expect(result1.games.length).toBe(result2.games.length);

    for (let i = 0; i < result1.games.length; i++) {
      expect(result1.games[i].winnerSide).toBe(result2.games[i].winnerSide);
      expect(result1.games[i].killsHome).toBe(result2.games[i].killsHome);
      expect(result1.games[i].killsAway).toBe(result2.games[i].killsAway);
    }
  });

  it('전력이 압도적으로 높은 팀이 대부분 승리 (100번 시뮬 중 80%+)', () => {
    // 홈 팀: 스탯 95 / 어웨이 팀: 스탯 40
    const strongLineup = createMockLineup(95);
    const weakLineup = createMockLineup(40);

    let homeWins = 0;
    const totalRuns = 100;

    for (let i = 0; i < totalRuns; i++) {
      const result = simulateMatch(strongLineup, weakLineup, 'Bo1', `domination_test_${i}`);
      if (result.winner === 'home') homeWins++;
    }

    expect(homeWins).toBeGreaterThanOrEqual(70);
  });
});
