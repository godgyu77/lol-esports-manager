export type EarlyStrategy = 'standard' | 'lane_swap' | 'invade' | 'safe_farm';
export type MidStrategy = 'balanced' | 'pick_comp' | 'split_push' | 'objective_control';
export type LateStrategy = 'teamfight' | 'split_push' | 'siege' | 'pick';
export type WardPriority = 'aggressive' | 'balanced' | 'defensive';

/** 역할별 지시 */
export type JungleInstruction = 'gank_heavy' | 'farm_heavy' | 'counter_jungle' | 'objective_focus';
export type LaneInstruction = 'play_safe' | 'aggressive_trade' | 'roam' | 'freeze';
export type SupportInstruction = 'roam_mid' | 'protect_adc' | 'ward_deep' | 'engage_primary';

export interface RoleInstructions {
  top: LaneInstruction;
  jungle: JungleInstruction;
  mid: LaneInstruction;
  adc: LaneInstruction;
  support: SupportInstruction;
}

/** 인게임 전술 전환 조건 */
export interface TacticalAdjustment {
  trigger: 'gold_lead_5k' | 'gold_behind_5k' | 'losing_early' | 'winning_early' | 'baron_taken' | 'elder_dragon';
  switchTo: {
    midStrategy?: MidStrategy;
    lateStrategy?: LateStrategy;
    aggressionLevel?: number;
  };
}

export interface TeamTactics {
  teamId: string;
  earlyStrategy: EarlyStrategy;
  midStrategy: MidStrategy;
  lateStrategy: LateStrategy;
  wardPriority: WardPriority;
  dragonPriority: number;    // 1-10
  baronPriority: number;     // 1-10
  aggressionLevel: number;   // 1-10
  /** 역할별 지시 (선택) */
  roleInstructions?: RoleInstructions;
  /** 인게임 전술 전환 규칙 (선택) */
  tacticalAdjustments?: TacticalAdjustment[];
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

export const JUNGLE_INSTRUCTION_LABELS: Record<JungleInstruction, string> = {
  gank_heavy: '갱킹 집중',
  farm_heavy: '파밍 집중',
  counter_jungle: '카운터 정글',
  objective_focus: '오브젝트 집중',
};

export const LANE_INSTRUCTION_LABELS: Record<LaneInstruction, string> = {
  play_safe: '안전 플레이',
  aggressive_trade: '공격적 교환',
  roam: '로밍',
  freeze: '프리징',
};

export const SUPPORT_INSTRUCTION_LABELS: Record<SupportInstruction, string> = {
  roam_mid: '미드 로밍',
  protect_adc: '원딜 보호',
  ward_deep: '딥 와딩',
  engage_primary: '이니시에이터',
};

/** 패치 메타 전략 효율 보정 (패치별로 변동) */
export interface PatchMetaModifiers {
  /** 한타 전략 효율 보정 (-0.1 ~ +0.1) */
  teamfightEfficiency: number;
  /** 스플릿 전략 효율 보정 */
  splitPushEfficiency: number;
  /** 초반 어그로 효율 보정 */
  earlyAggroEfficiency: number;
  /** 오브젝트 컨트롤 효율 보정 */
  objectiveEfficiency: number;
}
