export type FacilityType =
  | 'gaming_house'    // 게이밍 하우스 → 전체 훈련 효율
  | 'training_room'   // 훈련실 → 스탯 성장 속도
  | 'analysis_lab'    // 분석실 → 밴픽 정확도
  | 'gym'             // 체력단련실 → 스태미나 회복
  | 'media_room'      // 미디어룸 → 팬 행복도/스폰서십
  | 'cafeteria';      // 식당 → 사기 보정

export interface TeamFacility {
  teamId: string;
  facilityType: FacilityType;
  level: number;        // 1-5
  upgradeCost: number;  // 다음 레벨 비용 (만 원)
  effectValue: number;  // 현재 효과 수치
  lastUpgraded: string | null;
}

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  gaming_house: '게이밍 하우스',
  training_room: '훈련실',
  analysis_lab: '분석실',
  gym: '체력단련실',
  media_room: '미디어룸',
  cafeteria: '식당',
};

export const FACILITY_EFFECTS: Record<FacilityType, string> = {
  gaming_house: '전체 훈련 효율 +{value}%',
  training_room: '스탯 성장 속도 +{value}%',
  analysis_lab: '밴픽 추천 정확도 +{value}',
  gym: '스태미나 회복량 +{value}',
  media_room: '팬 행복도/스폰서십 수입 +{value}%',
  cafeteria: '선수 사기 보정 +{value}',
};
