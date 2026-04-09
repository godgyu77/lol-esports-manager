import { type MatchBroadcastTier } from '../../data/broadcastTalentDb';
import {
  getTeamBroadcastNarrative,
  type TeamBroadcastNarrative,
} from '../../data/teamBroadcastNarrativeDb';
import {
  findTeamBroadcastRivalry,
  type TeamBroadcastRivalry,
} from '../../data/teamRivalryBroadcastDb';

export interface BroadcastMatchContext {
  matchTier: MatchBroadcastTier;
  stakesTier: 'normal' | 'featured' | 'marquee';
  isRivalry: boolean;
  isOpeningMatch: boolean;
  homeNarrative: TeamBroadcastNarrative | null;
  awayNarrative: TeamBroadcastNarrative | null;
  rivalryContext: TeamBroadcastRivalry | null;
}

export function resolveBroadcastMatchTier(matchType?: string): MatchBroadcastTier {
  if (!matchType) return 'regular';
  if (matchType.includes('final')) return 'finals';
  if (matchType.startsWith('playoff_') || matchType.includes('quarter') || matchType.includes('semi')) return 'playoffs';
  return 'regular';
}

export function buildBroadcastMatchContext(params: {
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  matchType?: string;
  isOpeningMatch?: boolean;
}): BroadcastMatchContext {
  const matchTier = resolveBroadcastMatchTier(params.matchType);
  const rivalryContext = findTeamBroadcastRivalry(params.homeTeamId, params.awayTeamId);
  const stakesTier =
    matchTier === 'finals'
      ? 'marquee'
      : matchTier === 'playoffs'
        ? 'featured'
        : rivalryContext?.rivalryTier ?? 'normal';

  return {
    matchTier,
    stakesTier,
    isRivalry: Boolean(rivalryContext),
    isOpeningMatch: Boolean(params.isOpeningMatch),
    homeNarrative: getTeamBroadcastNarrative(params.homeTeamId),
    awayNarrative: getTeamBroadcastNarrative(params.awayTeamId),
    rivalryContext,
  };
}
