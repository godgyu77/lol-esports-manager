import { describe, expect, it } from 'vitest';
import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from '../data/rosterDb';
import { TEAM_STAFF_DB } from '../data/teamStaffDb';
import { getDisplayEntityName, localizeEntityNamesInText } from './displayName';

function collectRosterNames(): string[] {
  const leagues = [LCK_TEAMS, LPL_TEAMS, LEC_TEAMS, LCS_TEAMS];
  const names = new Set<string>();

  for (const league of leagues) {
    for (const team of Object.values(league)) {
      for (const player of team.roster) {
        names.add(player.name);
      }
    }
  }

  return [...names];
}

function collectStaffNames(): string[] {
  const names = new Set<string>();

  for (const entries of Object.values(TEAM_STAFF_DB)) {
    for (const entry of entries) {
      names.add(entry.name);
    }
  }

  return [...names];
}

describe('displayName', () => {
  it('keeps known roster names in their original public form', () => {
    expect(getDisplayEntityName('Faker')).toBe('Faker');
    expect(getDisplayEntityName('Oner')).toBe('Oner');
    expect(getDisplayEntityName('Tom')).toBe('Tom');
    expect(getDisplayEntityName('Homme')).toBe('Homme');
  });

  it('does not distort roster player display names', () => {
    for (const name of collectRosterNames()) {
      expect(getDisplayEntityName(name)).toBe(name);
    }
  });

  it('does not distort staff display names', () => {
    for (const name of collectStaffNames()) {
      expect(getDisplayEntityName(name)).toBe(name);
    }
  });

  it('only replaces explicitly mapped names inside text content', () => {
    const localized = localizeEntityNamesInText('Faker and Tom discussed a draft plan with Oner.');
    expect(localized).toBe('Faker and Tom discussed a draft plan with Oner.');
  });
});
