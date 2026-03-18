export type ClauseType = 'appearance_bonus' | 'performance_bonus' | 'relegation_release' | 'loyalty_bonus';

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
};
