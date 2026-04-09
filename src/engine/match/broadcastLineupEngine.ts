import {
  DEFAULT_BROADCAST_CREW,
  LCK_ANALYSTS,
  LCK_ANNOUNCERS,
  LCK_CASTERS,
  LCK_GUEST_ANALYSTS,
  type BroadcastCrew,
  type BroadcastTalent,
  type MatchBroadcastTier,
} from '../../data/broadcastTalentDb';
import { createRng } from '../../utils/rng';
import { buildBroadcastMatchContext, resolveBroadcastMatchTier } from './broadcastContext';

export interface BroadcastSelectionContext {
  isRivalry?: boolean;
  isOpeningMatch?: boolean;
  stakesTier?: 'normal' | 'featured' | 'marquee';
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamId?: string;
  awayTeamId?: string;
}

function weightedPick<T extends { weight?: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let cursor = rng() * total;
  for (const item of items) {
    cursor -= item.weight ?? 1;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1]!;
}

function weightedPickByValue<T>(items: T[], valueOf: (item: T) => number, rng: () => number): T {
  const total = items.reduce((sum, item) => sum + valueOf(item), 0);
  let cursor = rng() * total;
  for (const item of items) {
    cursor -= valueOf(item);
    if (cursor <= 0) return item;
  }
  return items[items.length - 1]!;
}

function pickDifferent<T extends { id: string; weight?: number }>(items: T[], excludedIds: string[], rng: () => number): T {
  const candidates = items.filter((item) => !excludedIds.includes(item.id));
  return weightedPick(candidates.length > 0 ? candidates : items, rng);
}

function shouldInviteGuest(matchTier: MatchBroadcastTier, context: BroadcastSelectionContext, rng: () => number) {
  if (matchTier === 'finals' || matchTier === 'playoffs') {
    return true;
  }

  let chance = 0.08;
  if (context.isOpeningMatch) chance += 0.06;
  if (context.isRivalry) chance += 0.08;
  if (context.stakesTier === 'featured') chance += 0.05;
  if (context.stakesTier === 'marquee') chance += 0.1;

  return rng() < chance;
}

function guestWeightForTier(
  talent: BroadcastTalent,
  matchTier: MatchBroadcastTier,
  context: BroadcastSelectionContext,
) {
  let weight =
    matchTier === 'finals'
      ? talent.guestWeightFinals
      : matchTier === 'playoffs'
        ? talent.guestWeightPlayoffs
        : talent.guestWeightRegular;

  if (context.stakesTier === 'featured') {
    weight += 6;
  }
  if (context.stakesTier === 'marquee') {
    weight += 12;
  }
  if (context.isOpeningMatch) {
    weight += 4;
  }
  if (
    context.isRivalry &&
    (talent.id === 'han-wangho-peanut' || talent.id === 'lee-seohaeng-kuro' || talent.id === 'gang-beomhyeon-gorilla')
  ) {
    weight += 8;
  }

  return Math.max(weight, 0);
}

export function selectGuestAnalyst(
  matchTier: MatchBroadcastTier,
  context: BroadcastSelectionContext,
  rng: () => number,
): BroadcastTalent | null {
  const pool = LCK_GUEST_ANALYSTS.filter((talent) => {
    if (matchTier === 'regular') return talent.appearances.includes('regular') || talent.appearances.includes('desk');
    if (matchTier === 'playoffs') {
      return (
        talent.appearances.includes('playoffs') || talent.appearances.includes('finals') || talent.appearances.includes('desk')
      );
    }
    return talent.appearances.includes('finals') || talent.appearances.includes('desk');
  });

  if (pool.length === 0) return null;
  return weightedPickByValue(pool, (talent) => guestWeightForTier(talent, matchTier, context), rng);
}

export function selectBroadcastCrew(params: {
  seed: string;
  matchType?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  isRivalry?: boolean;
  isOpeningMatch?: boolean;
  stakesTier?: 'normal' | 'featured' | 'marquee';
}): BroadcastCrew {
  const rng = createRng(params.seed || 'broadcast-default');
  const matchContext = buildBroadcastMatchContext({
    homeTeamId: params.homeTeamId,
    awayTeamId: params.awayTeamId,
    matchType: params.matchType,
    isOpeningMatch: params.isOpeningMatch,
  });
  const matchTier = resolveBroadcastMatchTier(params.matchType);
  const context: BroadcastSelectionContext = {
    homeTeamId: params.homeTeamId,
    awayTeamId: params.awayTeamId,
    homeTeamName: params.homeTeamName,
    awayTeamName: params.awayTeamName,
    isRivalry: params.isRivalry ?? matchContext.isRivalry,
    isOpeningMatch: params.isOpeningMatch ?? false,
    stakesTier: params.stakesTier ?? matchContext.stakesTier,
  };

  const caster = weightedPick(LCK_CASTERS, rng);
  const announcer = weightedPick(LCK_ANNOUNCERS, rng);
  const clem = LCK_ANALYSTS.find((analyst) => analyst.id === 'lee-hyeonwoo-clem') ?? DEFAULT_BROADCAST_CREW.analystPrimary;
  const analystPrimary =
    rng() < 0.93 ? clem : weightedPick(LCK_ANALYSTS.filter((analyst) => analyst.id !== clem.id), rng);

  const analystSecondary = pickDifferent(LCK_ANALYSTS, [analystPrimary.id], rng);
  const guestAnalyst = shouldInviteGuest(matchTier, context, rng) ? selectGuestAnalyst(matchTier, context, rng) : null;

  return {
    caster,
    analystPrimary,
    analystSecondary,
    announcer,
    guestAnalyst,
  };
}
