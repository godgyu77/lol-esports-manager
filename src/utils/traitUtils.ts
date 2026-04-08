import { TRAIT_LIBRARY, type Trait, type TraitEffectProfile, type TraitPolarity } from '../data/traitLibrary';

export interface ResolvedTrait extends Trait {
  id: string;
}

export const TRAIT_POLARITY_LABELS: Record<TraitPolarity, string> = {
  positive: '긍정',
  negative: '부정',
  mixed: '혼합',
  prospect: '성장형',
};

export const TRAIT_POLARITY_COLORS: Record<TraitPolarity, { bg: string; border: string; text: string }> = {
  positive: { bg: 'rgba(30, 181, 111, 0.18)', border: 'rgba(30, 181, 111, 0.45)', text: '#7be6ae' },
  negative: { bg: 'rgba(220, 68, 68, 0.16)', border: 'rgba(220, 68, 68, 0.45)', text: '#ff9f9f' },
  mixed: { bg: 'rgba(241, 181, 55, 0.16)', border: 'rgba(241, 181, 55, 0.45)', text: '#ffd477' },
  prospect: { bg: 'rgba(77, 144, 254, 0.16)', border: 'rgba(77, 144, 254, 0.45)', text: '#9fc6ff' },
};

const EMPTY_EFFECT_PROFILE: Required<TraitEffectProfile> = {
  lane: 0,
  teamfight: 0,
  consistency: 0,
  risk: 0,
  growth: 0,
  championPool: 0,
  mental: 0,
  shotcalling: 0,
};

export function getTrait(traitId: string): ResolvedTrait | null {
  const trait = TRAIT_LIBRARY[traitId];
  return trait ? { id: traitId, ...trait } : null;
}

export function getResolvedTraits(traitIds: string[]): ResolvedTrait[] {
  return traitIds
    .map(getTrait)
    .filter((trait): trait is ResolvedTrait => trait !== null);
}

export function getTraitsByPolarity(traitIds: string[]): Record<TraitPolarity, ResolvedTrait[]> {
  const grouped: Record<TraitPolarity, ResolvedTrait[]> = {
    positive: [],
    negative: [],
    mixed: [],
    prospect: [],
  };

  for (const trait of getResolvedTraits(traitIds)) {
    grouped[trait.polarity].push(trait);
  }

  return grouped;
}

export function getCombinedTraitEffectProfile(traitIds: string[]): Required<TraitEffectProfile> {
  return getResolvedTraits(traitIds).reduce<Required<TraitEffectProfile>>((acc, trait) => ({
    lane: acc.lane + (trait.effectProfile?.lane ?? 0),
    teamfight: acc.teamfight + (trait.effectProfile?.teamfight ?? 0),
    consistency: acc.consistency + (trait.effectProfile?.consistency ?? 0),
    risk: acc.risk + (trait.effectProfile?.risk ?? 0),
    growth: acc.growth + (trait.effectProfile?.growth ?? 0),
    championPool: acc.championPool + (trait.effectProfile?.championPool ?? 0),
    mental: acc.mental + (trait.effectProfile?.mental ?? 0),
    shotcalling: acc.shotcalling + (trait.effectProfile?.shotcalling ?? 0),
  }), { ...EMPTY_EFFECT_PROFILE });
}

export function getTraitBadgeStyle(traitId: string): { background: string; border: string; color: string } {
  const trait = TRAIT_LIBRARY[traitId];
  if (!trait) {
    return {
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      color: 'var(--text-secondary)',
    };
  }

  const palette = TRAIT_POLARITY_COLORS[trait.polarity];
  return {
    background: palette.bg,
    border: `1px solid ${palette.border}`,
    color: palette.text,
  };
}
