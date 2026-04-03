import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelect = vi.fn();
const mockExecute = vi.fn();
const mockGetAllPlayers = vi.fn();
const mockNextRandom = vi.fn();
const mockRelationshipSnapshot = vi.fn();
const mockInternationalSnapshot = vi.fn();

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    select: (...args: unknown[]) => mockSelect(...args),
    execute: (...args: unknown[]) => mockExecute(...args),
  }),
}));

vi.mock('../../db/queries', () => ({
  getAllPlayers: (...args: unknown[]) => mockGetAllPlayers(...args),
}));

vi.mock('../../utils/random', () => ({
  nextRandom: () => mockNextRandom(),
}));

vi.mock('../manager/releaseDepthEngine', () => ({
  getRelationshipInfluenceSnapshot: (...args: unknown[]) => mockRelationshipSnapshot(...args),
  getInternationalExpectationSnapshot: (...args: unknown[]) => mockInternationalSnapshot(...args),
}));

import { checkRetirementCandidates } from './retirementEngine';
import type { Player } from '../../types/player';

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'player_1',
    name: 'Veteran Mid',
    teamId: 'team_1',
    position: 'mid',
    age: 32,
    nationality: 'KR',
    stats: {
      mechanical: 72,
      gameSense: 80,
      teamwork: 78,
      consistency: 76,
      laning: 74,
      aggression: 68,
    },
    mental: {
      mental: 72,
      stamina: 70,
      morale: 65,
    },
    contract: {
      salary: 4000,
      contractEndSeason: 7,
    },
    championPool: [],
    potential: 72,
    peakAge: 24,
    popularity: 70,
    secondaryPosition: null,
    playstyle: 'versatile',
    careerGames: 300,
    chemistry: {},
    formHistory: [72, 71, 70, 69, 68, 67],
    ...overrides,
  };
}

describe('checkRetirementCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllPlayers.mockResolvedValue([createPlayer()]);
    mockNextRandom.mockReturnValue(0.5);
    mockRelationshipSnapshot.mockResolvedValue({
      teamId: 'team_1',
      strongPairs: [],
      riskPairs: [],
      mentorLinks: [],
      staffTrust: 60,
      moraleImpact: 0,
      transferImpact: 0,
      summary: '',
    });
    mockInternationalSnapshot.mockResolvedValue({
      teamId: 'team_1',
      seasonId: 3,
      label: 'International broadcast desk',
      level: 'baseline',
      summary: '',
      styleClash: '',
      boardPressureNote: '',
      legacyImpact: '',
      tags: ['league'],
    });
    mockSelect.mockImplementation(async (query: string) => {
      if (query.includes('FROM player_awards')) return [{ cnt: 1 }];
      if (query.includes('SELECT id, name, team_id, position, age, game_sense FROM players')) {
        return [{ id: 'player_1', name: 'Veteran Mid', team_id: 'team_1', position: 'mid', age: 32, game_sense: 80 }];
      }
      if (query.includes('FROM awards')) return [];
      if (query.includes('FROM player_career_stats')) return [];
      return [];
    });
    mockExecute.mockResolvedValue({ rowsAffected: 1 });
  });

  it('reduces retirement when strong bonds and international legacy pressure exist', async () => {
    mockRelationshipSnapshot.mockResolvedValueOnce({
      teamId: 'team_1',
      strongPairs: [{ names: ['Veteran Mid', 'Shotcaller Sup'], score: 85, tag: 'duo' }],
      riskPairs: [],
      mentorLinks: [{ names: ['Veteran Mid', 'Rookie Top'], score: 80, tag: 'mentor' }],
      staffTrust: 72,
      moraleImpact: 6,
      transferImpact: 8,
      summary: '',
    });
    mockInternationalSnapshot.mockResolvedValueOnce({
      teamId: 'team_1',
      seasonId: 3,
      label: 'International broadcast desk',
      level: 'must_deliver',
      summary: '',
      styleClash: '',
      boardPressureNote: '',
      legacyImpact: '',
      tags: ['international', 'pressure'],
    });
    mockNextRandom.mockReturnValueOnce(0.7);

    const result = await checkRetirementCandidates(3, '2026-11-01', 7);

    expect(result).toHaveLength(0);
  });

  it('raises retirement risk when room conflict is active', async () => {
    mockRelationshipSnapshot.mockResolvedValueOnce({
      teamId: 'team_1',
      strongPairs: [],
      riskPairs: [{ names: ['Veteran Mid', 'Frustrated Jungler'], score: 20, tag: 'rift' }],
      mentorLinks: [],
      staffTrust: 40,
      moraleImpact: -8,
      transferImpact: 0,
      summary: '',
    });
    mockNextRandom.mockReturnValueOnce(0.8);

    const result = await checkRetirementCandidates(3, '2026-11-01', 7);

    expect(result).toHaveLength(1);
    expect(result[0]?.reason).toContain('라커룸');
  });
});
