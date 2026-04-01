import { beforeEach, describe, expect, it, vi } from 'vitest';

const getPlayerChemistryLinksMock = vi.fn();

vi.mock('../../db/queries', () => ({
  getPlayersByTeamId: vi.fn(),
  adjustPlayerChemistry: vi.fn(),
  upsertPlayerChemistry: vi.fn(),
  getPlayerChemistryLinks: getPlayerChemistryLinksMock,
}));

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../personality/personalityEngine', () => ({
  getPlayerPersonality: vi.fn(),
  calculatePersonalityCompatibility: vi.fn(() => 0),
}));

describe('chemistryEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns chemistry links regardless of stored pair direction', async () => {
    getPlayerChemistryLinksMock.mockResolvedValue([
      { playerId: 'player-b', otherPlayerId: 'player-a', chemistryScore: 77 },
    ]);

    const { getPlayerChemistry } = await import('./chemistryEngine');
    const result = await getPlayerChemistry('player-b');

    expect(result).toEqual([
      {
        playerAId: 'player-b',
        playerBId: 'player-a',
        chemistryScore: 77,
      },
    ]);
  });
});
