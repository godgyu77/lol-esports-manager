/**
 * teamRating 단위 테스트
 * - buildLineup, evaluateTeam, evaluateMatchup 등 순수 함수 테스트
 * - DB 의존 함수 제외
 */

import { describe, it, expect } from 'vitest';
import {
  buildLineup,
  evaluateTeam,
  evaluateMatchup,
  calculatePlayerRating,
  calculateLaningRating,
  calculateTeamfightRating,
  calculateMentalModifier,
  type Lineup,
} from './teamRating';
import type { Player } from '../../types/player';
import type { Position } from '../../types/game';

// ─────────────────────────────────────────
// 헬퍼: mock 데이터 생성
// ─────────────────────────────────────────

/** 기본 선수 생성 */
function createMockPlayer(overrides: Partial<Player> & { position: Position; id?: string }): Player {
  const defaults: Player = {
    id: overrides.id ?? `player_${overrides.position}_${Math.random().toString(36).slice(2, 6)}`,
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
  };

  return {
    ...defaults,
    ...overrides,
    stats: { ...defaults.stats, ...(overrides.stats ?? {}) },
    mental: { ...defaults.mental, ...(overrides.mental ?? {}) },
    contract: { ...defaults.contract, ...(overrides.contract ?? {}) },
  };
}

/** 5포지션 라인업 생성 */
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

/** division 필드가 포함된 로스터 선수 생성 */
function createRosterPlayer(
  position: Position,
  division: string,
  id?: string,
): Player & { division: string } {
  return {
    ...createMockPlayer({ position, id: id ?? `roster_${position}_${division}` }),
    division,
  };
}

// ─────────────────────────────────────────
// buildLineup 테스트
// ─────────────────────────────────────────

describe('buildLineup', () => {
  it('5명의 1군 선수가 있으면 라인업을 구성', () => {
    const roster = [
      createRosterPlayer('top', 'main'),
      createRosterPlayer('jungle', 'main'),
      createRosterPlayer('mid', 'main'),
      createRosterPlayer('adc', 'main'),
      createRosterPlayer('support', 'main'),
    ];

    const lineup = buildLineup(roster);

    expect(lineup).not.toBeNull();
    expect(lineup!.top.position).toBe('top');
    expect(lineup!.jungle.position).toBe('jungle');
    expect(lineup!.mid.position).toBe('mid');
    expect(lineup!.adc.position).toBe('adc');
    expect(lineup!.support.position).toBe('support');
  });

  it('2군 선수만 있는 포지션이 있으면 null 반환', () => {
    const roster = [
      createRosterPlayer('top', 'main'),
      createRosterPlayer('jungle', 'main'),
      createRosterPlayer('mid', 'sub'),  // 2군만 있음
      createRosterPlayer('adc', 'main'),
      createRosterPlayer('support', 'main'),
    ];

    const lineup = buildLineup(roster);

    expect(lineup).toBeNull();
  });

  it('포지션이 빠진 경우 null 반환', () => {
    const roster = [
      createRosterPlayer('top', 'main'),
      createRosterPlayer('jungle', 'main'),
      createRosterPlayer('mid', 'main'),
      createRosterPlayer('adc', 'main'),
      // support 없음
    ];

    const lineup = buildLineup(roster);

    expect(lineup).toBeNull();
  });

  it('1군/2군 혼합 로스터에서 1군만 선택', () => {
    const roster = [
      createRosterPlayer('top', 'main', 'top_main'),
      createRosterPlayer('top', 'sub', 'top_sub'),
      createRosterPlayer('jungle', 'main', 'jg_main'),
      createRosterPlayer('mid', 'main', 'mid_main'),
      createRosterPlayer('mid', 'sub', 'mid_sub'),
      createRosterPlayer('adc', 'main', 'adc_main'),
      createRosterPlayer('support', 'main', 'sup_main'),
    ];

    const lineup = buildLineup(roster);

    expect(lineup).not.toBeNull();
    expect(lineup!.top.id).toBe('top_main');
    expect(lineup!.mid.id).toBe('mid_main');
  });

  it('빈 로스터면 null 반환', () => {
    const lineup = buildLineup([]);

    expect(lineup).toBeNull();
  });
});

// ─────────────────────────────────────────
// calculatePlayerRating 테스트
// ─────────────────────────────────────────

describe('calculatePlayerRating', () => {
  it('모든 스탯이 동일하면 해당 값과 같은 레이팅', () => {
    const player = createMockPlayer({
      position: 'mid',
      stats: {
        mechanical: 80,
        gameSense: 80,
        teamwork: 80,
        consistency: 80,
        laning: 80,
        aggression: 80,
      },
    });

    // 가중합: 80*0.2 + 80*0.2 + 80*0.15 + 80*0.15 + 80*0.15 + 80*0.15 = 80
    expect(calculatePlayerRating(player)).toBeCloseTo(80, 1);
  });

  it('mechanical/gameSense 개별 가중치(0.20)가 다른 스탯 개별 가중치(0.15)보다 높음', () => {
    // mechanical만 +10 올린 선수 vs laning만 +10 올린 선수
    const mechBoosted = createMockPlayer({
      position: 'mid',
      stats: {
        mechanical: 80,
        gameSense: 70,
        teamwork: 70,
        consistency: 70,
        laning: 70,
        aggression: 70,
      },
    });

    const laningBoosted = createMockPlayer({
      position: 'mid',
      stats: {
        mechanical: 70,
        gameSense: 70,
        teamwork: 70,
        consistency: 70,
        laning: 80,
        aggression: 70,
      },
    });

    // mechanical 가중치 0.20 > laning 가중치 0.15 → mechBoosted가 더 높음
    expect(calculatePlayerRating(mechBoosted)).toBeGreaterThan(calculatePlayerRating(laningBoosted));
  });
});

// ─────────────────────────────────────────
// calculateLaningRating / calculateTeamfightRating 테스트
// ─────────────────────────────────────────

describe('calculateLaningRating', () => {
  it('laning 스탯이 높을수록 라인전 전력이 높음', () => {
    const laningPlayer = createMockPlayer({
      position: 'top',
      stats: { mechanical: 70, gameSense: 70, teamwork: 70, consistency: 70, laning: 95, aggression: 70 },
    });
    const defaultPlayer = createMockPlayer({
      position: 'top',
    });

    expect(calculateLaningRating(laningPlayer)).toBeGreaterThan(calculateLaningRating(defaultPlayer));
  });
});

describe('calculateTeamfightRating', () => {
  it('teamwork/gameSense 스탯이 높을수록 한타 전력이 높음', () => {
    const teamfightPlayer = createMockPlayer({
      position: 'support',
      stats: { mechanical: 70, gameSense: 95, teamwork: 95, consistency: 70, laning: 70, aggression: 70 },
    });
    const defaultPlayer = createMockPlayer({
      position: 'support',
    });

    expect(calculateTeamfightRating(teamfightPlayer)).toBeGreaterThan(calculateTeamfightRating(defaultPlayer));
  });
});

// ─────────────────────────────────────────
// calculateMentalModifier 테스트
// ─────────────────────────────────────────

describe('calculateMentalModifier', () => {
  it('기본값(mental=70, stamina=80, morale=70)이면 보정값 0', () => {
    const player = createMockPlayer({ position: 'mid' });

    expect(calculateMentalModifier(player)).toBeCloseTo(0, 5);
  });

  it('높은 멘탈은 양수 보정', () => {
    const player = createMockPlayer({
      position: 'mid',
      mental: { mental: 90, stamina: 90, morale: 90 },
    });

    expect(calculateMentalModifier(player)).toBeGreaterThan(0);
  });

  it('낮은 멘탈은 음수 보정', () => {
    const player = createMockPlayer({
      position: 'mid',
      mental: { mental: 40, stamina: 50, morale: 40 },
    });

    expect(calculateMentalModifier(player)).toBeLessThan(0);
  });
});

// ─────────────────────────────────────────
// evaluateTeam 테스트
// ─────────────────────────────────────────

describe('evaluateTeam', () => {
  it('라인업으로 팀 전력을 계산하면 overall이 0~100 범위', () => {
    const lineup = createMockLineup(70);
    const result = evaluateTeam(lineup);

    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it('스탯이 높은 라인업이 더 높은 overall', () => {
    const strongLineup = createMockLineup(90);
    const weakLineup = createMockLineup(50);

    const strongResult = evaluateTeam(strongLineup);
    const weakResult = evaluateTeam(weakLineup);

    expect(strongResult.overall).toBeGreaterThan(weakResult.overall);
  });

  it('포지션별 전력(byPosition)에 5포지션 모두 포함', () => {
    const lineup = createMockLineup(70);
    const result = evaluateTeam(lineup);
    const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

    for (const pos of positions) {
      expect(result.byPosition[pos]).toBeDefined();
      expect(typeof result.byPosition[pos]).toBe('number');
    }
  });

  it('laningPower와 teamfightPower 모두 0~100 범위', () => {
    const lineup = createMockLineup(70);
    const result = evaluateTeam(lineup);

    expect(result.laningPower).toBeGreaterThanOrEqual(0);
    expect(result.laningPower).toBeLessThanOrEqual(100);
    expect(result.teamfightPower).toBeGreaterThanOrEqual(0);
    expect(result.teamfightPower).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────
// evaluateMatchup 테스트
// ─────────────────────────────────────────

describe('evaluateMatchup', () => {
  it('동일 전력 팀이면 홈 승률이 약 50%', () => {
    const lineup = createMockLineup(70);
    const result = evaluateMatchup(lineup, lineup);

    // 동일 전력이면 승률 차이가 크지 않아야 함
    expect(result.homeWinRate).toBeGreaterThanOrEqual(0.4);
    expect(result.homeWinRate).toBeLessThanOrEqual(0.6);
  });

  it('강팀이 홈이면 승률이 50% 초과', () => {
    const strongLineup = createMockLineup(90);
    const weakLineup = createMockLineup(50);

    const result = evaluateMatchup(strongLineup, weakLineup);

    expect(result.homeWinRate).toBeGreaterThan(0.5);
  });

  it('약팀이 홈이어도 최소 승률 15% 보장 (업셋 보장)', () => {
    const strongLineup = createMockLineup(95);
    const weakLineup = createMockLineup(30);

    const result = evaluateMatchup(weakLineup, strongLineup);

    expect(result.homeWinRate).toBeGreaterThanOrEqual(0.15);
  });

  it('승률이 최대 85%를 넘지 않음 (업셋 보장)', () => {
    const strongLineup = createMockLineup(95);
    const weakLineup = createMockLineup(30);

    const result = evaluateMatchup(strongLineup, weakLineup);

    expect(result.homeWinRate).toBeLessThanOrEqual(0.85);
  });

  it('포지션별 매치업(laneMatchups)에 5포지션 모두 포함', () => {
    const homeLineup = createMockLineup(70);
    const awayLineup = createMockLineup(60);
    const result = evaluateMatchup(homeLineup, awayLineup);
    const positions: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];

    for (const pos of positions) {
      expect(result.laneMatchups[pos]).toBeDefined();
      expect(typeof result.laneMatchups[pos]).toBe('number');
    }
  });
});
