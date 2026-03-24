export type ClauseType = 'appearance_bonus' | 'performance_bonus' | 'relegation_release' | 'loyalty_bonus' | 'release_clause' | 'signing_bonus';

export interface ContractClause {
  id: number;
  playerId: string;
  clauseType: ClauseType;
  clauseValue: number;
  conditionText: string | null;
  isTriggered: boolean;
}

export const CLAUSE_TYPE_LABELS: Record<ClauseType, string> = {
  appearance_bonus: '출전 보너스',
  performance_bonus: '성과 보너스',
  relegation_release: '강등 시 방출 조항',
  loyalty_bonus: '충성 보너스',
  release_clause: '바이아웃 조항',
  signing_bonus: '계약 보너스',
};

// ─────────────────────────────────────────
// 계약 협상 시스템
// ─────────────────────────────────────────

export type NegotiationInitiator = 'team_to_player' | 'player_to_team';
export type NegotiationStatus = 'pending' | 'in_progress' | 'accepted' | 'rejected' | 'expired';

/** 선수의 계약 의사결정 요인 (각 0~100) */
export interface ContractDecisionFactors {
  money: number;       // 연봉/돈 중시
  winning: number;     // 우승 가능성 중시
  playtime: number;    // 출전 기회 중시
  loyalty: number;     // 팀 충성도
  reputation: number;  // 팀 명성/브랜드 중시
}

/** 협상 메시지 */
export interface NegotiationMessage {
  round: number;
  from: 'team' | 'player' | 'agent';
  text: string;
  salary?: number;
  years?: number;
  signingBonus?: number;
  timestamp: string;
}

/** 계약 협상 */
export interface ContractNegotiation {
  id: number;
  seasonId: number;
  playerId: string;
  teamId: string;
  initiator: NegotiationInitiator;
  status: NegotiationStatus;
  currentRound: number;
  // 팀 측 제안
  teamSalary: number;
  teamYears: number;
  teamSigningBonus: number;
  // 선수 측 요구/역제안
  playerSalary: number | null;
  playerYears: number | null;
  playerSigningBonus: number | null;
  // 의사결정 요인
  factors: ContractDecisionFactors;
  // 최종 합의
  finalSalary: number | null;
  finalYears: number | null;
  finalSigningBonus: number | null;
  // 메시지 로그
  messages: NegotiationMessage[];
}

/** 선수가 팀을 평가한 종합 점수 */
export interface TeamEvaluation {
  overall: number;           // 종합 (0~100)
  salaryScore: number;       // 연봉 만족도
  winningScore: number;      // 우승 가능성
  playtimeScore: number;     // 출전 기회
  loyaltyScore: number;      // 충성도/편안함
  reputationScore: number;   // 팀 명성
  reasons: string[];         // 평가 사유
}
