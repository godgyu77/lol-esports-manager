import { describe, expect, it } from 'vitest';

import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from './rosterDb';
import { TEAM_STAFF_DB } from './teamStaffDb';

function buildTeamIds(prefix: string, teams: Record<string, unknown>): string[] {
  return Object.keys(teams).map((key) => `${prefix}_${key}`);
}

describe('TEAM_STAFF_DB', () => {
  it('covers every seeded team with at least one fixed staff member', () => {
    const allTeamIds = [
      ...buildTeamIds('lck', LCK_TEAMS),
      ...buildTeamIds('lpl', LPL_TEAMS),
      ...buildTeamIds('lcs', LCS_TEAMS),
      ...buildTeamIds('lec', LEC_TEAMS),
    ];

    expect(Object.keys(TEAM_STAFF_DB).sort()).toEqual(allTeamIds.sort());
    for (const teamId of allTeamIds) {
      expect(TEAM_STAFF_DB[teamId].length).toBeGreaterThan(0);
    }
  });

  it('assigns a head coach to every fixed team staff entry set', () => {
    for (const [teamId, entries] of Object.entries(TEAM_STAFF_DB)) {
      expect(entries.some((entry) => entry.role === 'head_coach')).toBe(true);
      expect(entries[0]?.name?.length ?? 0, teamId).toBeGreaterThan(0);
    }
  });

  it('reflects 2026-04 LCK coaching staffs for the major corrected teams', () => {
    expect(TEAM_STAFF_DB.lck_T1.find((entry) => entry.role === 'head_coach')?.name).toBe('Tom');
    expect(TEAM_STAFF_DB.lck_T1.some((entry) => entry.name === 'Mata' && entry.role === 'coach')).toBe(true);

    expect(TEAM_STAFF_DB.lck_GEN.find((entry) => entry.role === 'head_coach')?.name).toBe('Ryu');
    expect(TEAM_STAFF_DB.lck_GEN.some((entry) => entry.name === 'Lyn' && entry.role === 'coach')).toBe(true);

    expect(TEAM_STAFF_DB.lck_HLE.find((entry) => entry.role === 'head_coach')?.name).toBe('Homme');
    expect(TEAM_STAFF_DB.lck_HLE.some((entry) => entry.name === 'Mowgli')).toBe(true);

    expect(TEAM_STAFF_DB.lck_DK.find((entry) => entry.role === 'head_coach')?.name).toBe('cvMax');
    expect(TEAM_STAFF_DB.lck_DK.some((entry) => entry.name === 'PoohManDu')).toBe(true);

    expect(TEAM_STAFF_DB.lck_KT.find((entry) => entry.role === 'head_coach')?.name).toBe('Score');
    expect(TEAM_STAFF_DB.lck_KT.some((entry) => entry.name === 'Highness' && entry.role === 'analyst')).toBe(true);

    expect(TEAM_STAFF_DB.lck_NS.find((entry) => entry.role === 'head_coach')?.name).toBe('DanDy');
    expect(TEAM_STAFF_DB.lck_NS.some((entry) => entry.name === 'Chelly')).toBe(true);

    expect(TEAM_STAFF_DB.lck_SOOPers.find((entry) => entry.role === 'head_coach')?.name).toBe('oDin');
    expect(TEAM_STAFF_DB.lck_BFX.find((entry) => entry.role === 'head_coach')?.name).toBe('Edo');
    expect(TEAM_STAFF_DB.lck_BRION.find((entry) => entry.role === 'head_coach')?.name).toBe('Ssong');

    expect(TEAM_STAFF_DB.lck_KRX.find((entry) => entry.role === 'head_coach')?.name).toBe('Joker');
    expect(TEAM_STAFF_DB.lck_KRX.some((entry) => entry.name === 'Saroo' && entry.role === 'coach')).toBe(true);
  });

  it('reflects updated LPL coaching staffs from current public pages', () => {
    expect(TEAM_STAFF_DB.lpl_TES.find((entry) => entry.role === 'head_coach')?.name).toBe('Poppy');
    expect(TEAM_STAFF_DB.lpl_TES.filter((entry) => entry.role === 'coach')).toHaveLength(1);
    expect(TEAM_STAFF_DB.lpl_JDG.find((entry) => entry.role === 'head_coach')?.name).toBe('Tabe');
    expect(TEAM_STAFF_DB.lpl_EDG.find((entry) => entry.role === 'head_coach')?.name).toBe('Clearlove');
    expect(TEAM_STAFF_DB.lpl_EDG.some((entry) => entry.name === 'Maokai' && entry.role === 'coach')).toBe(true);
    expect(TEAM_STAFF_DB.lpl_AL.find((entry) => entry.role === 'head_coach')?.name).toBe('Helper');
    expect(TEAM_STAFF_DB.lpl_TT.find((entry) => entry.role === 'head_coach')?.name).toBe('NONAME');
    expect(TEAM_STAFF_DB.lpl_LNG.find((entry) => entry.role === 'head_coach')?.name).toBe('Edgar');
    expect(TEAM_STAFF_DB.lpl_LNG.some((entry) => entry.name === 'Viod' && entry.role === 'coach')).toBe(true);
  });

  it('reflects updated LCS and LEC coaching staffs from public team pages', () => {
    expect(TEAM_STAFF_DB.lcs_FLY.find((entry) => entry.role === 'head_coach')?.name).toBe('Thinkcard');
    expect(TEAM_STAFF_DB.lcs_TL.some((entry) => entry.name === 'Spookz' && entry.role === 'coach')).toBe(true);
    expect(TEAM_STAFF_DB.lcs_C9.find((entry) => entry.role === 'head_coach')?.name).toBe('Inero');
    expect(TEAM_STAFF_DB.lcs_LYON.find((entry) => entry.role === 'head_coach')?.name).toBe('Reignover');

    expect(TEAM_STAFF_DB.lec_FNC.find((entry) => entry.role === 'head_coach')?.name).toBe('GrabbZ');
    expect(TEAM_STAFF_DB.lec_KC.find((entry) => entry.role === 'head_coach')?.name).toBe('Reapered');
    expect(TEAM_STAFF_DB.lec_TH.find((entry) => entry.role === 'head_coach')?.name).toBe('Hidon');
    expect(TEAM_STAFF_DB.lec_TH.some((entry) => entry.name === 'Mithy' && entry.role === 'coach')).toBe(true);
    expect(TEAM_STAFF_DB.lec_NAVI.find((entry) => entry.role === 'head_coach')?.name).toBe('TheRock');
  });
});
