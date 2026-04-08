import { describe, expect, it } from 'vitest';

import { LCK_TEAMS, LCS_TEAMS, LEC_TEAMS, LPL_TEAMS } from './rosterDb';

describe('LCK roster reality updates', () => {
  it('keeps KT first-team support on Effort and moves Peter to the challengers roster', () => {
    const kt = LCK_TEAMS.KT;
    expect(kt.roster.slice(0, 6).map((player) => player.name)).toEqual([
      'PerfecT',
      'Cuzz',
      'Bdd',
      'Aiming',
      'Effort',
      'Pollu',
    ]);
    expect(kt.roster.map((player) => player.name)).toContain('Peter');
  });

  it('adds Calix as Nongshim RedForce six-man while keeping Scout on mid', () => {
    const ns = LCK_TEAMS.NS;
    expect(ns.roster.slice(0, 6).map((player) => player.name)).toEqual([
      'Kingen',
      'Sponge',
      'Scout',
      'Taeyoon',
      'Lehends',
      'Calix',
    ]);
  });

  it('renames DRX to KRX and keeps Vincenzo as the six-man', () => {
    expect(LCK_TEAMS.DRX).toBeUndefined();

    const krx = LCK_TEAMS.KRX;
    expect(krx.teamName).toBe('KRX');
    expect(krx.roster.slice(0, 6).map((player) => player.name)).toEqual([
      'Rich',
      'Willer',
      'Ucal',
      'Jiwoo',
      'Andil',
      'Vincenzo',
    ]);
    expect(krx.roster.map((player) => player.name)).toContain('Winner');
  });

  it('reflects updated public first-team and challengers data for additional LCK teams', () => {
    expect(LCK_TEAMS.SOOPers.roster.slice(0, 6).map((player) => player.name)).toEqual([
      'DuDu',
      'Pyosik',
      'Clozer',
      'deokdam',
      'Life',
      'Peter',
    ]);

    expect(LCK_TEAMS.BRION.roster.slice(0, 6).map((player) => player.name)).toEqual([
      'Morgan',
      'HamBak',
      'Roamer',
      'Hype',
      'Pollu',
      'Loki',
    ]);

    expect(LCK_TEAMS.T1.roster.slice(6).map((player) => player.name)).toEqual([
      'Haetae',
      'Painter',
      'Guti',
      'Cypher',
      'Cloud',
    ]);
  });
});

describe('cross-league roster reality updates', () => {
  it('matches the revised LPL public rosters', () => {
    expect(LPL_TEAMS.TES.roster.slice(0, 5).map((player) => player.name)).toEqual([
      '369',
      'naiyou',
      'Creme',
      'JiaQi',
      'fengyue',
    ]);

    expect(LPL_TEAMS.WBG.roster.slice(0, 5).map((player) => player.name)).toEqual([
      'Zika',
      'jiejie',
      'Xiaohu',
      'Elk',
      'Erha',
    ]);

    expect(LPL_TEAMS.NIP.roster[4]?.name).toBe('Zhuo');
    expect(LPL_TEAMS.UP.roster.slice(0, 5).map((player) => player.name)).toEqual([
      'Liangchen',
      'Grizzly',
      'Saber',
      'Hena',
      'Xiaoxia',
    ]);
  });

  it('matches the revised LCS and LEC public rosters', () => {
    expect(LCS_TEAMS.LYON.roster[0]?.name).toBe('Dhokla');

    expect(LEC_TEAMS.KOI.roster[5]?.name).toBe('ToniOP');
    expect(LEC_TEAMS.TH.roster[4]?.name).toBe('Way');
    expect(LEC_TEAMS.NAVI.roster[5]?.name).toBe('Larssen');
  });
});
