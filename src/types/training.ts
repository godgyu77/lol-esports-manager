export type TrainingType =
  | 'general'        // 종합 훈련
  | 'laning'         // 라인전 특화
  | 'teamfight'      // 한타 특화
  | 'macro'          // 거시적 운영 (gameSense)
  | 'champion_pool'  // 챔피언 풀 확장
  | 'mental'         // 멘탈 강화
  | 'physical';      // 체력 관리

export type TrainingIntensity = 'light' | 'normal' | 'intense';

export type TrainableStat =
  | 'mechanical'
  | 'gameSense'
  | 'teamwork'
  | 'consistency'
  | 'laning'
  | 'aggression';

export interface TrainingScheduleEntry {
  teamId: string;
  dayOfWeek: number;        // 0~6
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

/** 훈련 타입별 표시 정보 */
export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  general: '종합 훈련',
  laning: '라인전 특화',
  teamfight: '한타 특화',
  macro: '운영 특화',
  champion_pool: '챔피언 풀 확장',
  mental: '멘탈 강화',
  physical: '체력 관리',
};

/** 훈련 타입 → 관련 스탯 매핑 */
export const TRAINING_STAT_MAP: Record<TrainingType, TrainableStat[]> = {
  general: ['mechanical', 'gameSense', 'teamwork', 'consistency', 'laning', 'aggression'],
  laning: ['laning', 'mechanical'],
  teamfight: ['teamwork', 'aggression'],
  macro: ['gameSense', 'consistency'],
  champion_pool: [],  // 챔피언 숙련도만 변화
  mental: [],         // 멘탈/스태미나만 변화
  physical: [],       // 스태미나만 변화
};
