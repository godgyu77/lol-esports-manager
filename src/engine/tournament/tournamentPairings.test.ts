import { describe, expect, it } from 'vitest';
import { buildSeededQuarterfinalPairs, drawFSTBracket } from './tournamentPairings';

describe('tournamentPairings', () => {
  it('builds seeded quarterfinal pairs in 1v8, 2v7 order', () => {
    expect(buildSeededQuarterfinalPairs(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'])).toEqual([
      ['t1', 't8'],
      ['t2', 't7'],
      ['t3', 't6'],
      ['t4', 't5'],
    ]);
  });

  it('prefers cross-region pairings for FST opening bracket', () => {
    const bracket = drawFSTBracket([
      { teamId: 'lck1', region: 'LCK' },
      { teamId: 'lpl1', region: 'LPL' },
      { teamId: 'lec1', region: 'LEC' },
      { teamId: 'lcs1', region: 'LCS' },
      { teamId: 'lck2', region: 'LCK' },
      { teamId: 'lpl2', region: 'LPL' },
      { teamId: 'lec2', region: 'LEC' },
      { teamId: 'lcs2', region: 'LCS' },
    ]);

    expect(bracket).toHaveLength(4);
    for (const [home, away] of bracket) {
      expect(home.slice(0, 3)).not.toBe(away.slice(0, 3));
    }
  });
});
