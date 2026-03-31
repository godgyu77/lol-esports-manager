export type TrainingType =
  | 'general'
  | 'laning'
  | 'teamfight'
  | 'macro'
  | 'champion_pool'
  | 'mental'
  | 'physical';

export type TrainingIntensity = 'light' | 'normal' | 'intense';

export type TrainingActivity = 'training' | 'scrim' | 'rest';

export type TrainableStat =
  | 'mechanical'
  | 'gameSense'
  | 'teamwork'
  | 'consistency'
  | 'laning'
  | 'aggression';

export interface TrainingScheduleEntry {
  teamId: string;
  dayOfWeek: number;
  activityType: TrainingActivity;
  trainingType: TrainingType;
  intensity: TrainingIntensity;
}

export interface PlayerTrainingAssignment {
  playerId: string;
  teamId: string;
  trainingType: TrainingType;
  targetStat: TrainableStat | null;
  targetChampionId: string | null;
}

export interface TrainingLog {
  playerId: string;
  trainingDate: string;
  trainingType: TrainingType;
  statChanged: string | null;
  statDelta: number;
  championId: string | null;
  championDelta: number;
}

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  general: '종합 훈련',
  laning: '라인전 특화',
  teamfight: '한타 특화',
  macro: '운영 특화',
  champion_pool: '챔피언 풀 확장',
  mental: '멘탈 강화',
  physical: '체력 관리',
};

export const TRAINING_ACTIVITY_LABELS: Record<TrainingActivity, string> = {
  training: '훈련',
  scrim: '스크림',
  rest: '휴식',
};

export const TRAINING_STAT_MAP: Record<TrainingType, TrainableStat[]> = {
  general: ['mechanical', 'gameSense', 'teamwork', 'consistency', 'laning', 'aggression'],
  laning: ['laning', 'mechanical'],
  teamfight: ['teamwork', 'aggression'],
  macro: ['gameSense', 'consistency'],
  champion_pool: [],
  mental: [],
  physical: [],
};
