export interface PlayerPersonality {
  playerId: string;
  ambition: number;        // 1~10: 높으면 이적 요구 빈번, 성장 동기
  loyalty: number;         // 1~10: 높으면 팀 잔류, 약속 불이행 덜 민감
  professionalism: number; // 1~10: 높으면 훈련 효율 보너스
  temperament: number;     // 1~10: 높으면 멘탈 안정, 낮으면 폭발적
  determination: number;   // 1~10: 높으면 폼 회복/부상 복귀 빠름
}

export const PERSONALITY_LABELS: Record<keyof Omit<PlayerPersonality, 'playerId'>, string> = {
  ambition: '야망',
  loyalty: '충성심',
  professionalism: '프로의식',
  temperament: '기질',
  determination: '결단력',
};

export const PERSONALITY_DESC: Record<keyof Omit<PlayerPersonality, 'playerId'>, string> = {
  ambition: '높으면 이적/연봉 요구 빈번, 성장 동기 높음',
  loyalty: '높으면 팀 잔류 경향, 약속 불이행에 관대',
  professionalism: '높으면 훈련 효율 +10%, 불만 적음',
  temperament: '높으면 멘탈 안정, 낮으면 팀 토크에 과민',
  determination: '높으면 폼 회복 빠름, 부상 결장 -20%',
};
