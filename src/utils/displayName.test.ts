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
  it('maps key player and staff names to Korean labels', () => {
    expect(getDisplayEntityName('Faker')).toBe('페이커');
    expect(getDisplayEntityName('Oner')).toBe('오너');
    expect(getDisplayEntityName('Tom')).toBe('톰');
    expect(getDisplayEntityName('Homme')).toBe('옴므');
    expect(getDisplayEntityName('VACANT')).toBe('공석');
  });

  it('does not leave latin letters in roster player display names', () => {
    for (const name of collectRosterNames()) {
      expect(getDisplayEntityName(name)).not.toMatch(/[A-Za-z]/);
    }
  });

  it('does not leave latin letters in staff display names', () => {
    for (const name of collectStaffNames()) {
      expect(getDisplayEntityName(name)).not.toMatch(/[A-Za-z]/);
    }
  });

  it('localizes names embedded inside text content', () => {
    const localized = localizeEntityNamesInText('Faker and Tom discussed a draft plan with Oner.');
    expect(localized).toContain('페이커');
    expect(localized).toContain('톰');
    expect(localized).toContain('오너');
    expect(localized).not.toMatch(/[A-Za-z]/);
  });
});
