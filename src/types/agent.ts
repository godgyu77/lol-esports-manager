/** 선수 에이전트 */
export interface PlayerAgent {
  id: number;
  playerId: string;
  agentName: string;
  greedLevel: number;       // 1~10 (높을수록 요구 많음)
  loyaltyToPlayer: number;  // 1~10
}

/** 에이전트 협상 결과 */
export interface AgentNegotiationResult {
  accepted: boolean;
  counterOffer: number;  // 에이전트 요구 연봉
  message: string;
}

/** 에이전트가 가져온 타팀 제안 */
export interface AgentBringOfferResult {
  hasOffer: boolean;
  fromTeamId?: string;
  fromTeamName?: string;
  offeredSalary?: number;
  message: string;
}
