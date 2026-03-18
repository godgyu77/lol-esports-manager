export type PlayerGoalType = 'mvp_candidate' | 'all_pro' | 'international' | 'starter' | 'improve_stat';

export interface PlayerGoal {
  id: number;
  playerId: string;
  seasonId: number;
  goalType: PlayerGoalType;
  targetValue: string | null;
  isAchieved: boolean;
  rewardMorale: number;
}

export const PLAYER_GOAL_LABELS: Record<PlayerGoalType, string> = {
  mvp_candidate: 'MVP 후보 진입',
  all_pro: 'All-Pro 팀 선정',
  international: '국제대회 진출',
  starter: '주전 자리 확보',
  improve_stat: '스탯 향상',
};
