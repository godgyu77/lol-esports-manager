import { LCK_ANALYSTS, LCK_GUEST_ANALYSTS } from '../../data/broadcastTalentDb';
import { selectBroadcastCrew } from './broadcastLineupEngine';

describe('broadcastLineupEngine', () => {
  it('keeps 클템 above 90 percent in regular-season samples', () => {
    let clemCount = 0;

    for (let i = 0; i < 1000; i += 1) {
      const crew = selectBroadcastCrew({
        seed: `regular-${i}`,
        matchType: 'regular',
        homeTeamId: 'lck_T1',
        awayTeamId: 'lck_GEN',
        homeTeamName: 'T1',
        awayTeamName: 'Gen.G',
      });
      if (crew.analystPrimary.id === 'lee-hyeonwoo-clem' || crew.analystSecondary.id === 'lee-hyeonwoo-clem') {
        clemCount += 1;
      }
    }

    expect(clemCount).toBeGreaterThanOrEqual(900);
  });

  it('always adds a guest analyst for finals', () => {
    const crew = selectBroadcastCrew({
      seed: 'finals-1',
      matchType: 'playoff_final',
      homeTeamId: 'lck_T1',
      awayTeamId: 'lck_GEN',
      homeTeamName: 'T1',
      awayTeamName: 'Gen.G',
    });

    expect(crew.guestAnalyst).toBeTruthy();
  });

  it('can occasionally add guest analysts in regular season', () => {
    let guestCount = 0;
    for (let i = 0; i < 200; i += 1) {
      const crew = selectBroadcastCrew({
        seed: `rival-${i}`,
        matchType: 'regular',
        homeTeamId: 'lck_T1',
        awayTeamId: 'lck_GEN',
        homeTeamName: 'T1',
        awayTeamName: 'Gen.G',
      });
      if (crew.guestAnalyst) guestCount += 1;
    }

    expect(guestCount).toBeGreaterThan(0);
  });

  it('keeps all regular broadcast talents fully described', () => {
    [...LCK_ANALYSTS, ...LCK_GUEST_ANALYSTS].forEach((talent) => {
      expect(talent.speechStyle.length).toBeGreaterThan(0);
      expect(talent.signaturePhrases.length).toBeGreaterThan(0);
      expect(talent.eventStrengths.length).toBeGreaterThan(0);
      expect(talent.deskSummaryStyle.length).toBeGreaterThan(0);
    });
  });

  it('prefers marquee guest analysts in finals over regular-season desk-style picks', () => {
    const seen = new Set<string>();

    for (let i = 0; i < 200; i += 1) {
      const crew = selectBroadcastCrew({
        seed: `final-marquee-${i}`,
        matchType: 'playoff_final',
        homeTeamId: 'lck_T1',
        awayTeamId: 'lck_GEN',
        homeTeamName: 'T1',
        awayTeamName: 'Gen.G',
      });
      if (crew.guestAnalyst) {
        seen.add(crew.guestAnalyst.id);
      }
    }

    expect(seen.has('han-wangho-peanut')).toBe(true);
    expect(seen.has('lee-seohaeng-kuro')).toBe(true);
  });
});
