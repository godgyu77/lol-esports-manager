/**
 * 시즌 100회 자동 시뮬레이션 — 밸런스 검증 테스트
 *
 * - 10개 팀(전력 60~80) × 더블 라운드 로빈
 * - 100시즌 반복 → 우승팀 분포, 평균 승률, 서포트 KDA 등 통계 출력
 */

import { describe, it, expect } from 'vitest';
import { simulateMatch, type MatchResult, type PlayerGameStatLine } from './matchSimulator';
import type { Lineup } from './teamRating';
import type { Player } from '../../types/player';
import type { Position } from '../../types/game';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

const NUM_TEAMS = 10;
const NUM_SEASONS = 100;
const TEAM_STATS = [60, 63, 66, 68, 70, 72, 74, 76, 78, 80]; // 10개 팀 전력
const POSITIONS: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
const BO_FORMAT = 'Bo3' as const;

// ─────────────────────────────────────────
// Mock 데이터 생성
// ─────────────────────────────────────────

function createPlayer(teamIdx: number, pos: Position, avgStat: number): Player {
  return {
    id: `team${teamIdx}_${pos}`,
    name: `T${teamIdx} ${pos}`,
    teamId: `team_${teamIdx}`,
    position: pos,
    secondaryPosition: null,
    age: 22,
    nationality: 'KR',
    stats: {
      mechanical: avgStat,
      gameSense: avgStat,
      teamwork: avgStat,
      consistency: avgStat,
      laning: avgStat,
      aggression: avgStat,
    },
    mental: {
      mental: 70,
      stamina: 80,
      morale: 70,
    },
    contract: { salary: 3000, contractEndSeason: 5 },
    championPool: [{ championId: 'champ1', proficiency: 80, gamesPlayed: 50 }],
    potential: 70,
    peakAge: 23,
    popularity: 50,
    playstyle: 'versatile',
    careerGames: 100,
    chemistry: {},
    formHistory: [],
  };
}

function createLineup(teamIdx: number, avgStat: number): Lineup {
  const lineup = {} as Record<Position, Player>;
  for (const pos of POSITIONS) {
    lineup[pos] = createPlayer(teamIdx, pos, avgStat);
  }
  return lineup as Lineup;
}

// ─────────────────────────────────────────
// 더블 라운드 로빈 스케줄 생성
// ─────────────────────────────────────────

interface ScheduleMatch {
  homeIdx: number;
  awayIdx: number;
  matchIndex: number;
}

function generateDoubleRoundRobin(numTeams: number): ScheduleMatch[] {
  const matches: ScheduleMatch[] = [];
  let idx = 0;
  // 각 팀이 다른 모든 팀과 홈/어웨이 1번씩
  for (let h = 0; h < numTeams; h++) {
    for (let a = 0; a < numTeams; a++) {
      if (h !== a) {
        matches.push({ homeIdx: h, awayIdx: a, matchIndex: idx++ });
      }
    }
  }
  return matches;
}

// ─────────────────────────────────────────
// 통계 수집
// ─────────────────────────────────────────

interface SeasonStats {
  wins: number[];       // 팀별 승수
  losses: number[];     // 팀별 패수
  championIdx: number;  // 최다승 팀 인덱스
}

interface PositionKDA {
  kills: number;
  deaths: number;
  assists: number;
  games: number;
}

// ─────────────────────────────────────────
// 시뮬레이션 실행
// ─────────────────────────────────────────

function runSimulation() {
  const lineups = TEAM_STATS.map((stat, i) => createLineup(i, stat));
  const schedule = generateDoubleRoundRobin(NUM_TEAMS);

  const championCount = new Array(NUM_TEAMS).fill(0);
  const totalWins = new Array(NUM_TEAMS).fill(0);
  const totalLosses = new Array(NUM_TEAMS).fill(0);

  // 포지션별 KDA 누적
  const positionKDA: Record<Position, PositionKDA> = {} as Record<Position, PositionKDA>;
  for (const pos of POSITIONS) {
    positionKDA[pos] = { kills: 0, deaths: 0, assists: 0, games: 0 };
  }

  // 시리즈 길이 통계
  let totalSeries = 0;
  let fullLengthSeries = 0; // Bo3에서 3세트까지 간 경우

  for (let season = 0; season < NUM_SEASONS; season++) {
    const seasonWins = new Array(NUM_TEAMS).fill(0);
    const seasonLosses = new Array(NUM_TEAMS).fill(0);

    for (const match of schedule) {
      const seed = `s${season}_m${match.matchIndex}`;
      const result: MatchResult = simulateMatch(
        lineups[match.homeIdx],
        lineups[match.awayIdx],
        BO_FORMAT,
        seed,
      );

      if (result.winner === 'home') {
        seasonWins[match.homeIdx]++;
        seasonLosses[match.awayIdx]++;
      } else {
        seasonWins[match.awayIdx]++;
        seasonLosses[match.homeIdx]++;
      }

      totalWins[match.homeIdx] += result.winner === 'home' ? 1 : 0;
      totalWins[match.awayIdx] += result.winner === 'away' ? 1 : 0;
      totalLosses[match.homeIdx] += result.winner === 'away' ? 1 : 0;
      totalLosses[match.awayIdx] += result.winner === 'home' ? 1 : 0;

      // 시리즈 길이 통계
      totalSeries++;
      if (result.games.length === 3) fullLengthSeries++;

      // 포지션별 KDA 수집
      for (const game of result.games) {
        const collectStats = (stats: PlayerGameStatLine[]) => {
          for (const ps of stats) {
            const kda = positionKDA[ps.position];
            kda.kills += ps.kills;
            kda.deaths += ps.deaths;
            kda.assists += ps.assists;
            kda.games++;
          }
        };
        collectStats(game.playerStatsHome);
        collectStats(game.playerStatsAway);
      }
    }

    // 시즌 우승 (최다승)
    let maxWins = -1;
    let champIdx = 0;
    for (let i = 0; i < NUM_TEAMS; i++) {
      if (seasonWins[i] > maxWins) {
        maxWins = seasonWins[i];
        champIdx = i;
      }
    }
    championCount[champIdx]++;
  }

  return { championCount, totalWins, totalLosses, positionKDA, totalSeries, fullLengthSeries };
}

// ─────────────────────────────────────────
// 테스트
// ─────────────────────────────────────────

describe('밸런스 시뮬레이션 (100시즌)', () => {
  const result = runSimulation();
  const totalGamesPerTeam = NUM_SEASONS * (NUM_TEAMS - 1) * 2; // 더블 라운드 로빈

  it('전력 상위 팀(80)이 하위 팀(60)보다 우승 횟수 많음', () => {
    const topTeamChamps = result.championCount[9]; // stat 80
    const bottomTeamChamps = result.championCount[0]; // stat 60
    console.log('\n=== 우승팀 분포 ===');
    TEAM_STATS.forEach((stat, i) => {
      console.log(`  팀 ${i} (전력 ${stat}): 우승 ${result.championCount[i]}회`);
    });
    expect(topTeamChamps).toBeGreaterThan(bottomTeamChamps);
  });

  it('팀별 평균 승률이 전력에 비례', () => {
    console.log('\n=== 팀별 승률 ===');
    const winRates = TEAM_STATS.map((stat, i) => {
      const wr = result.totalWins[i] / totalGamesPerTeam;
      console.log(`  팀 ${i} (전력 ${stat}): ${(wr * 100).toFixed(1)}% (${result.totalWins[i]}승 ${result.totalLosses[i]}패)`);
      return wr;
    });

    // 전력 70 팀(인덱스 4)의 승률이 40~60% 범위
    const midTeamWR = winRates[4];
    expect(midTeamWR).toBeGreaterThan(0.40);
    expect(midTeamWR).toBeLessThan(0.60);

    // 전력 80 팀이 전력 60 팀보다 승률 높음
    expect(winRates[9]).toBeGreaterThan(winRates[0]);
  });

  it('포지션별 KDA 분포 — 서포트 KDA가 비정상적이지 않음', () => {
    console.log('\n=== 포지션별 평균 KDA ===');
    const kdaByPos: Record<string, number> = {};

    for (const pos of POSITIONS) {
      const { kills, deaths, assists, games } = result.positionKDA[pos];
      const avgK = kills / games;
      const avgD = deaths / games;
      const avgA = assists / games;
      const kda = deaths > 0 ? (kills + assists) / Math.max(1, deaths) : 0;
      const avgKDA = (kills + assists) / Math.max(1, deaths);
      kdaByPos[pos] = avgKDA;
      console.log(`  ${pos}: K=${avgK.toFixed(1)} D=${avgD.toFixed(1)} A=${avgA.toFixed(1)} KDA=${avgKDA.toFixed(2)} (${games} games)`);
    }

    // 서포트 KDA가 0.5 이상 (극단적으로 낮지 않음)
    expect(kdaByPos['support']).toBeGreaterThan(0.5);
    // 서포트 KDA가 ADC KDA의 3배를 넘지 않음 (비정상적으로 높지 않음)
    expect(kdaByPos['support']).toBeLessThan(kdaByPos['adc'] * 3);
  });

  it('Bo3 시리즈에서 풀세트(3세트) 비율이 20~60%', () => {
    const fullSetRate = result.fullLengthSeries / result.totalSeries;
    console.log(`\n=== 시리즈 통계 ===`);
    console.log(`  총 시리즈: ${result.totalSeries}`);
    console.log(`  풀세트 비율: ${(fullSetRate * 100).toFixed(1)}%`);
    expect(fullSetRate).toBeGreaterThan(0.20);
    expect(fullSetRate).toBeLessThan(0.60);
  });
});
