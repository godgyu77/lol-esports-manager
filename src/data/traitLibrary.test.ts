import { describe, expect, it } from 'vitest';

import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from './rosterDb';
import { TRAIT_LIBRARY } from './traitLibrary';

const ALL_TEAMS = [LCK_TEAMS, LPL_TEAMS, LCS_TEAMS, LEC_TEAMS];

describe('trait library coverage', () => {
  it('defines every trait used by the roster database', () => {
    const traitIds = new Set<string>();

    for (const league of ALL_TEAMS) {
      for (const team of Object.values(league)) {
        for (const player of team.roster) {
          for (const traitId of player.traits) {
            traitIds.add(traitId);
          }
        }
      }
    }

    for (const traitId of traitIds) {
      expect(TRAIT_LIBRARY[traitId], `${traitId} should be defined`).toBeDefined();
    }
  });

  it('classifies representative traits by polarity', () => {
    expect(TRAIT_LIBRARY.THROWING.polarity).toBe('negative');
    expect(TRAIT_LIBRARY.PLAYMAKER.polarity).toBe('positive');
    expect(TRAIT_LIBRARY.COIN_FLIP.polarity).toBe('mixed');
    expect(TRAIT_LIBRARY.GROWTH_POTENTIAL.polarity).toBe('prospect');
  });
});
