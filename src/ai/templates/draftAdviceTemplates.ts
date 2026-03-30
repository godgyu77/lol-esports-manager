export type DraftAdviceTemplate = {
  suggestion: string;
  reason: string;
  confidence: number;
};

export const FALLBACK_BAN_ADVICE_ASSETS: readonly DraftAdviceTemplate[] = [
  { suggestion: '상대 핵심 챔피언을 밴하세요', reason: '상대 시그니처 픽을 차단하는 것이 가장 안정적입니다.', confidence: 60 },
  { suggestion: '현 메타 상위 티어 챔피언을 밴하세요', reason: '열리면 조합 완성도가 크게 올라갈 수 있습니다.', confidence: 65 },
  { suggestion: '우리 조합의 카운터 챔피언을 밴하세요', reason: '조합의 약점을 먼저 막아두는 편이 안전합니다.', confidence: 58 },
];

export const FALLBACK_PICK_ADVICE_ASSETS: readonly DraftAdviceTemplate[] = [
  { suggestion: '조합과 잘 맞는 안정적인 픽을 고르세요', reason: '밸런스 있는 조합이 승률을 높여줍니다.', confidence: 60 },
  { suggestion: '상대 조합을 압박할 수 있는 카운터 픽을 고려하세요', reason: '라인전과 교전 모두에서 변수 창출이 가능합니다.', confidence: 58 },
  { suggestion: '선수 숙련도가 높은 챔피언을 우선하세요', reason: '낯선 챔피언보다 확실한 숙련도가 실전에서 강합니다.', confidence: 65 },
];
