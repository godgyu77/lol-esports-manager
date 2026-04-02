export type StaffRole =
  | 'head_coach'
  | 'coach'
  | 'analyst'
  | 'scout_manager'
  | 'sports_psychologist'
  | 'nutritionist'
  | 'physiotherapist'
  | 'data_analyst';

export type StaffSpecialty = 'training' | 'draft' | 'mentoring' | 'conditioning';
export type CoachingPhilosophy = 'aggressive' | 'defensive' | 'balanced' | 'developmental';
export type StaffRoleFlexibility = 'strict' | 'normal' | 'flexible';
export type StaffOfferDecision = 'accept' | 'hesitate' | 'reject';
export type StaffAcceptanceLevel = 'high' | 'medium' | 'low' | 'unlikely';

export interface Staff {
  id: number;
  teamId: string | null;
  name: string;
  role: StaffRole;
  ability: number;
  specialty: StaffSpecialty | null;
  salary: number;
  morale: number;
  contractEndSeason: number;
  hiredDate: string;
  isFreeAgent: boolean;
  philosophy: CoachingPhilosophy | null;
  nationality: string | null;
  preferredRole: StaffRole;
  roleFlexibility: StaffRoleFlexibility;
  careerOrigin: StaffRole | null;
}

export interface StaffOfferEvaluation {
  staff: Staff;
  offeredRole: StaffRole;
  decision: StaffOfferDecision;
  acceptance: StaffAcceptanceLevel;
  score: number;
  reasons: string[];
}

export interface StaffCandidateView extends StaffOfferEvaluation {
  marketCategory: 'coach' | 'former_head_coach' | 'specialist';
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

export const STAFF_ROLE_EFFECTS: Record<StaffRole, string> = {
  head_coach: '전체 훈련 효율과 사기 안정에 영향을 줍니다.',
  coach: '특정 훈련 효율과 선수 성장 보정이 올라갑니다.',
  analyst: '밴픽 추천 정확도와 상대 분석력이 올라갑니다.',
  scout_manager: '스카우팅 정확도와 발굴 효율이 올라갑니다.',
  sports_psychologist: '사기 회복과 압박 저항에 도움을 줍니다.',
  nutritionist: '체력 회복과 부상 예방을 돕습니다.',
  physiotherapist: '부상 회복과 재부상 방지에 도움을 줍니다.',
  data_analyst: '상대 분석과 메타 적응 보정을 제공합니다.',
};

export const COACHING_PHILOSOPHY_LABELS: Record<CoachingPhilosophy, string> = {
  aggressive: '공격형',
  defensive: '수비형',
  balanced: '균형형',
  developmental: '육성형',
};

export const STAFF_ROLE_FLEXIBILITY_LABELS: Record<StaffRoleFlexibility, string> = {
  strict: '역할 고집',
  normal: '기본 선호',
  flexible: '유연함',
};
