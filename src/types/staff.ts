export type StaffRole = 'head_coach' | 'coach' | 'analyst' | 'scout_manager' | 'sports_psychologist' | 'nutritionist' | 'physiotherapist' | 'data_analyst';
export type StaffSpecialty = 'training' | 'draft' | 'mentoring' | 'conditioning';
export type CoachingPhilosophy = 'aggressive' | 'defensive' | 'balanced' | 'developmental';

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
  /** 감독 전용: 코칭 철학 */
  philosophy: CoachingPhilosophy | null;
  /** 국적 (코치-선수 케미 계산용) */
  nationality: string | null;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  head_coach: '감독',
  coach: '코치',
  analyst: '분석관',
  scout_manager: '스카우트 매니저',
  sports_psychologist: '스포츠 심리상담사',
  nutritionist: '영양사',
  physiotherapist: '물리치료사',
  data_analyst: '데이터 분석가',
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
  sports_psychologist: '사기 회복 가속 + 압박 저항력 향상',
  nutritionist: '스태미나 회복 가속 + 부상 예방',
  physiotherapist: '부상 회복 속도 향상 + 재부상 방지',
  data_analyst: '상대 분석 정확도 + 메타 적응 가속',
};

export const COACHING_PHILOSOPHY_LABELS: Record<CoachingPhilosophy, string> = {
  aggressive: '공격적',
  defensive: '수비적',
  balanced: '균형형',
  developmental: '육성형',
};
