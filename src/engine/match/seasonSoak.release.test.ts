import { describe, expect, it } from 'vitest';
import { simulateMatch, type MatchResult, type PlayerGameStatLine } from './matchSimulator';
import type { Lineup } from './teamRating';
import type { Player } from '../../types/player';
import type { Position } from '../../types/game';

const NUM_TEAMS = 10;
const NUM_SAVE_BRANCHES = 20;
const SEASONS_PER_BRANCH = 5;
const TOTAL_SIMULATED_SEASONS = NUM_SAVE_BRANCHES * SEASONS_PER_BRANCH;
const TEAM_STATS = [60, 63, 66, 68, 70, 72, 74, 76, 78, 80];
const POSITIONS: Position[] = ['top', 'jungle', 'mid', 'adc', 'support'];
const BO_FORMAT = 'Bo3' as const;

interface ScheduleMatch {
  homeIdx: number;
  awayIdx: number;
  matchIndex: number;
}

interface PositionKdaTotals {
  kills: number;
  deaths: number;
  assists: number;
  games: number;
}

interface SeasonSoakResult {
  championCount: number[];
  branchChampionVariety: number[];
  totalWins: number[];
  totalLosses: number[];
  totalSeries: number;
  fullLengthSeries: number;
  positionTotals: Record<Position, PositionKdaTotals>;
}

function createPlayer(teamIdx: number, pos: Position, avgStat: number): Player {
  return {
    id: `branch_player_${teamIdx}_${pos}`,
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

function generateDoubleRoundRobin(numTeams: number): ScheduleMatch[] {
  const matches: ScheduleMatch[] = [];
  let matchIndex = 0;
  for (let homeIdx = 0; homeIdx < numTeams; homeIdx += 1) {
    for (let awayIdx = 0; awayIdx < numTeams; awayIdx += 1) {
      if (homeIdx === awayIdx) continue;
      matches.push({ homeIdx, awayIdx, matchIndex: matchIndex += 1 });
    }
  }
  return matches;
}

function collectGameStats(stats: PlayerGameStatLine[], totals: Record<Position, PositionKdaTotals>) {
  for (const row of stats) {
    const bucket = totals[row.position];
    bucket.kills += row.kills;
    bucket.deaths += row.deaths;
    bucket.assists += row.assists;
    bucket.games += 1;
  }
}

function runSeasonSoak(): SeasonSoakResult {
  const schedule = generateDoubleRoundRobin(NUM_TEAMS);
  const championCount = new Array(NUM_TEAMS).fill(0);
  const branchChampionVariety: number[] = [];
  const totalWins = new Array(NUM_TEAMS).fill(0);
  const totalLosses = new Array(NUM_TEAMS).fill(0);
  const positionTotals = Object.fromEntries(
    POSITIONS.map((pos) => [pos, { kills: 0, deaths: 0, assists: 0, games: 0 }]),
  ) as Record<Position, PositionKdaTotals>;

  let totalSeries = 0;
  let fullLengthSeries = 0;

  for (let branch = 0; branch < NUM_SAVE_BRANCHES; branch += 1) {
    const lineups = TEAM_STATS.map((stat, index) => createLineup(index, stat));
    const branchChampions = new Set<number>();

    for (let season = 0; season < SEASONS_PER_BRANCH; season += 1) {
      const seasonWins = new Array(NUM_TEAMS).fill(0);

      for (const match of schedule) {
        const seed = `branch_${branch}_season_${season}_match_${match.matchIndex}`;
        const result: MatchResult = simulateMatch(
          lineups[match.homeIdx],
          lineups[match.awayIdx],
          BO_FORMAT,
          seed,
        );

        if (result.winner === 'home') {
          seasonWins[match.homeIdx] += 1;
          totalWins[match.homeIdx] += 1;
          totalLosses[match.awayIdx] += 1;
        } else {
          seasonWins[match.awayIdx] += 1;
          totalWins[match.awayIdx] += 1;
          totalLosses[match.homeIdx] += 1;
        }

        totalSeries += 1;
        if (result.games.length === 3) {
          fullLengthSeries += 1;
        }

        for (const game of result.games) {
          collectGameStats(game.playerStatsHome, positionTotals);
          collectGameStats(game.playerStatsAway, positionTotals);
        }
      }

      let championIdx = 0;
      let bestWins = -1;
      for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx += 1) {
        if (seasonWins[teamIdx] > bestWins) {
          bestWins = seasonWins[teamIdx];
          championIdx = teamIdx;
        }
      }
      championCount[championIdx] += 1;
      branchChampions.add(championIdx);
    }

    branchChampionVariety.push(branchChampions.size);
  }

  return {
    championCount,
    branchChampionVariety,
    totalWins,
    totalLosses,
    totalSeries,
    fullLengthSeries,
    positionTotals,
  };
}

describe('season soak release gate', () => {
  const result = runSeasonSoak();
  const matchesPerSeason = NUM_TEAMS * (NUM_TEAMS - 1);
  const expectedGamesPerTeam = TOTAL_SIMULATED_SEASONS * (NUM_TEAMS - 1) * 2;

  it('covers 100 simulated seasons across multiple save branches without breaking schedule invariants', () => {
    expect(TOTAL_SIMULATED_SEASONS).toBe(100);
    expect(result.totalSeries).toBe(TOTAL_SIMULATED_SEASONS * matchesPerSeason);

    for (let teamIdx = 0; teamIdx < NUM_TEAMS; teamIdx += 1) {
      expect(result.totalWins[teamIdx] + result.totalLosses[teamIdx]).toBe(expectedGamesPerTeam);
    }
  });

  it('keeps stronger teams ahead of weaker teams over the long run', () => {
    expect(result.championCount[9]).toBeGreaterThan(result.championCount[0]);
    expect(result.totalWins[9]).toBeGreaterThan(result.totalWins[0]);
  });

  it('preserves some title variety across save branches instead of collapsing into one winner', () => {
    const branchesWithVariety = result.branchChampionVariety.filter((count) => count >= 2).length;
    expect(branchesWithVariety).toBeGreaterThanOrEqual(10);
  });

  it('keeps Bo3 length and positional KDA in sane ranges during the soak', () => {
    const fullSetRate = result.fullLengthSeries / result.totalSeries;
    expect(fullSetRate).toBeGreaterThan(0.2);
    expect(fullSetRate).toBeLessThan(0.6);

    for (const pos of POSITIONS) {
      const totals = result.positionTotals[pos];
      const avgKda = (totals.kills + totals.assists) / Math.max(1, totals.deaths);
      expect(Number.isFinite(avgKda)).toBe(true);
      expect(avgKda).toBeGreaterThan(0.5);
    }
  });
});
