export type EarlyStrategy = 'standard' | 'lane_swap' | 'invade' | 'safe_farm';
export type MidStrategy = 'balanced' | 'pick_comp' | 'split_push' | 'objective_control';
export type LateStrategy = 'teamfight' | 'split_push' | 'siege' | 'pick';
export type WardPriority = 'aggressive' | 'balanced' | 'defensive';

export interface TeamTactics {
  teamId: string;
  earlyStrategy: EarlyStrategy;
  midStrategy: MidStrategy;
  lateStrategy: LateStrategy;
  wardPriority: WardPriority;
  dragonPriority: number;    // 1-10
  baronPriority: number;     // 1-10
  aggressionLevel: number;   // 1-10
}

export const EARLY_STRATEGY_LABELS: Record<EarlyStrategy, string> = {
  standard: '표준 라인전',
  lane_swap: '라인 스왑',
  invade: '인베이드',
  safe_farm: '안전 파밍',
};

export const MID_STRATEGY_LABELS: Record<MidStrategy, string> = {
  balanced: '밸런스 운영',
  pick_comp: '픽 조합',
  split_push: '스플릿 푸시',
  objective_control: '오브젝트 컨트롤',
};

export const LATE_STRATEGY_LABELS: Record<LateStrategy, string> = {
  teamfight: '한타 중심',
  split_push: '스플릿',
  siege: '시즈',
  pick: '픽 잡기',
};

export const WARD_PRIORITY_LABELS: Record<WardPriority, string> = {
  aggressive: '공격적',
  balanced: '균형',
  defensive: '수비적',
};
