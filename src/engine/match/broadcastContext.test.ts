import { ALL_BROADCAST_TEAM_IDS, TEAM_BROADCAST_NARRATIVES } from '../../data/teamBroadcastNarrativeDb';
import { getBroadcastRivalriesForTeam, findTeamBroadcastRivalry } from '../../data/teamRivalryBroadcastDb';
import { buildBroadcastMatchContext } from './broadcastContext';

describe('broadcastContext', () => {
  it('covers all 42 teams with broadcast narratives', () => {
    expect(Object.keys(TEAM_BROADCAST_NARRATIVES)).toHaveLength(42);
    ALL_BROADCAST_TEAM_IDS.forEach((teamId) => {
      expect(TEAM_BROADCAST_NARRATIVES[teamId]).toBeTruthy();
      expect(TEAM_BROADCAST_NARRATIVES[teamId]?.broadcastAlias.length).toBeGreaterThan(0);
      expect(TEAM_BROADCAST_NARRATIVES[teamId]?.playPatternNarrative.length).toBeGreaterThan(0);
    });
  });

  it('gives every team at least one rivalry or featured matchup', () => {
    ALL_BROADCAST_TEAM_IDS.forEach((teamId) => {
      expect(getBroadcastRivalriesForTeam(teamId).length).toBeGreaterThan(0);
    });
  });

  it('resolves rivalry context for explicit rivalry pairs', () => {
    const rivalry = findTeamBroadcastRivalry('lck_T1', 'lck_GEN');
    expect(rivalry?.rivalryTier).toBe('marquee');
  });

  it('builds narrative-rich match context', () => {
    const context = buildBroadcastMatchContext({
      homeTeamId: 'lck_HLE',
      awayTeamId: 'lck_DK',
      matchType: 'regular',
    });

    expect(context.isRivalry).toBe(true);
    expect(context.stakesTier).toBe('featured');
    expect(context.homeNarrative?.broadcastAlias).toContain('파괴');
    expect(context.rivalryContext?.headline.length).toBeGreaterThan(0);
  });
});
