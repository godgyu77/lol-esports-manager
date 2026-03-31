import { getDatabase } from '../../db/database';
import type { ManagerBackground, ManagerPhilosophy } from '../../types/manager';

export type ManagerIdentityAxis = keyof ManagerPhilosophy;

export interface ManagerIdentityProfile {
  saveId: number;
  name: string;
  background: ManagerBackground;
  philosophy: ManagerPhilosophy;
  dominantTraits: string[];
}

export interface ManagerIdentityEffects {
  playerMeetingBonus: number;
  complaintReliefBonus: number;
  trainingFocusBonus: number;
  formBoost: number;
  moraleRiskModifier: number;
  pressEffectBonus: number;
  sponsorReputationBonus: number;
}

export const MANAGER_PHILOSOPHY_LABELS: Record<ManagerIdentityAxis, string> = {
  playerCare: '선수 친화',
  tacticalFocus: '전술 중심',
  resultDriven: '성과 우선',
  mediaFriendly: '언론 친화',
};

export const MANAGER_BG_PHILOSOPHY: Record<ManagerBackground, ManagerPhilosophy> = {
  ex_player: { playerCare: 65, tacticalFocus: 50, resultDriven: 58, mediaFriendly: 60 },
  analyst: { playerCare: 42, tacticalFocus: 72, resultDriven: 55, mediaFriendly: 38 },
  rookie: { playerCare: 50, tacticalFocus: 50, resultDriven: 50, mediaFriendly: 50 },
  academy_coach: { playerCare: 72, tacticalFocus: 48, resultDriven: 44, mediaFriendly: 36 },
};

const AXES: ManagerIdentityAxis[] = ['playerCare', 'tacticalFocus', 'resultDriven', 'mediaFriendly'];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getInitialManagerPhilosophy(background: ManagerBackground): ManagerPhilosophy {
  return { ...MANAGER_BG_PHILOSOPHY[background] };
}

export function getDominantManagerTraits(philosophy: ManagerPhilosophy): string[] {
  return AXES
    .filter((axis) => philosophy[axis] >= 60)
    .sort((a, b) => philosophy[b] - philosophy[a])
    .slice(0, 2)
    .map((axis) => MANAGER_PHILOSOPHY_LABELS[axis]);
}

export async function getManagerIdentity(saveId: number): Promise<ManagerIdentityProfile | null> {
  const db = await getDatabase();
  const rows = await db.select<Array<{
    save_id: number;
    name: string;
    background: ManagerBackground;
    player_care: number | null;
    tactical_focus: number | null;
    result_driven: number | null;
    media_friendly: number | null;
  }>>(
    `SELECT save_id, name, background, player_care, tactical_focus, result_driven, media_friendly
     FROM manager_profiles
     WHERE save_id = $1
     LIMIT 1`,
    [saveId],
  );

  const row = rows[0];
  if (!row) return null;

  const fallback = getInitialManagerPhilosophy(row.background);
  const philosophy: ManagerPhilosophy = {
    playerCare: row.player_care ?? fallback.playerCare,
    tacticalFocus: row.tactical_focus ?? fallback.tacticalFocus,
    resultDriven: row.result_driven ?? fallback.resultDriven,
    mediaFriendly: row.media_friendly ?? fallback.mediaFriendly,
  };

  return {
    saveId: row.save_id,
    name: row.name,
    background: row.background,
    philosophy,
    dominantTraits: getDominantManagerTraits(philosophy),
  };
}

export async function shiftManagerIdentity(
  saveId: number,
  changes: Partial<Record<ManagerIdentityAxis, number>>,
): Promise<void> {
  const profile = await getManagerIdentity(saveId);
  if (!profile) return;

  const next: ManagerPhilosophy = {
    playerCare: clampScore(profile.philosophy.playerCare + (changes.playerCare ?? 0)),
    tacticalFocus: clampScore(profile.philosophy.tacticalFocus + (changes.tacticalFocus ?? 0)),
    resultDriven: clampScore(profile.philosophy.resultDriven + (changes.resultDriven ?? 0)),
    mediaFriendly: clampScore(profile.philosophy.mediaFriendly + (changes.mediaFriendly ?? 0)),
  };

  const db = await getDatabase();
  await db.execute(
    `UPDATE manager_profiles
     SET player_care = $2,
         tactical_focus = $3,
         result_driven = $4,
         media_friendly = $5
     WHERE save_id = $1`,
    [saveId, next.playerCare, next.tacticalFocus, next.resultDriven, next.mediaFriendly],
  );
}

export function getManagerIdentityEffects(philosophy: ManagerPhilosophy): ManagerIdentityEffects {
  const playerCareDelta = philosophy.playerCare - 50;
  const tacticalDelta = philosophy.tacticalFocus - 50;
  const resultDelta = philosophy.resultDriven - 50;
  const mediaDelta = philosophy.mediaFriendly - 50;

  return {
    playerMeetingBonus: Math.round(playerCareDelta / 15),
    complaintReliefBonus: Math.round(playerCareDelta / 20),
    trainingFocusBonus: Math.round(tacticalDelta / 18),
    formBoost: Math.round((tacticalDelta + resultDelta) / 30),
    moraleRiskModifier: Math.round(resultDelta / 20),
    pressEffectBonus: Math.round(mediaDelta / 15),
    sponsorReputationBonus: Math.max(0, Math.round(mediaDelta / 12)),
  };
}

export function getManagerIdentitySummaryLine(profile: ManagerIdentityProfile): string {
  const dominant = profile.dominantTraits.length > 0 ? profile.dominantTraits.join(', ') : '균형형';
  const effects = getManagerIdentityEffects(profile.philosophy);
  const emphasis =
    effects.playerMeetingBonus > effects.pressEffectBonus && effects.playerMeetingBonus > 0
      ? '선수 관리 쪽에서 효과가 더 잘 드러납니다.'
      : effects.pressEffectBonus > 0
        ? '언론 대응과 외부 평판 관리에 강점이 있습니다.'
        : effects.trainingFocusBonus > 0
          ? '훈련과 경기 준비에서 안정적인 보정이 들어갑니다.'
          : '아직 특정 성향보다 균형 잡힌 운영 쪽에 가깝습니다.';

  return `${dominant} 성향이 중심이며, ${emphasis}`;
}
