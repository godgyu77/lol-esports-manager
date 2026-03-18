export type StaffRole = 'head_coach' | 'coach' | 'analyst' | 'scout_manager';
export type StaffSpecialty = 'training' | 'draft' | 'mentoring' | 'conditioning';

export interface Staff {
  id: number;
  teamId: string | null;
  name: string;
  role: StaffRole;
  ability: number;       // 0-100
  specialty: StaffSpecialty | null;
  salary: number;        // 만 원/년
  morale: number;
  contractEndSeason: number;
  hiredDate: string;
  isFreeAgent: boolean;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  head_coach: '감독',
  coach: '코치',
  analyst: '분석관',
  scout_manager: '스카우트 매니저',
};

export const STAFF_SPECIALTY_LABELS: Record<StaffSpecialty, string> = {
  training: '훈련',
  draft: '밴픽 분석',
  mentoring: '선수 육성',
  conditioning: '컨디션 관리',
};

/** 스태프 역할별 효과 */
export const STAFF_ROLE_EFFECTS: Record<StaffRole, string> = {
  head_coach: '전체 훈련 효율 + 팀 사기 보정',
  coach: '특정 훈련 효율 증가',
  analyst: '밴픽 추천 정확도 향상',
  scout_manager: '스카우팅 속도/정확도 향상',
};
