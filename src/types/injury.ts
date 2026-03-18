export type InjuryType = 'wrist' | 'back' | 'eye' | 'mental_burnout' | 'minor' | 'tournament_absence';

export interface PlayerInjury {
  id: number;
  playerId: string;
  teamId: string;
  injuryType: InjuryType;
  severity: number;
  daysRemaining: number;
  occurredDate: string;
  expectedReturn: string;
  isRecovered: boolean;
}

export const INJURY_TYPE_LABELS: Record<InjuryType, string> = {
  wrist: '손목 부상',
  back: '허리 통증',
  eye: '안구 피로',
  mental_burnout: '번아웃',
  minor: '경미한 부상',
  tournament_absence: '국제대회 참가',
};

export const INJURY_SEVERITY_LABELS: Record<number, string> = {
  1: '경미 (3~7일)',
  2: '보통 (7~21일)',
  3: '심각 (21~42일)',
};
