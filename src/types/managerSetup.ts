import type { StaffRole } from './staff';
import type { TeamTactics } from './tactics';
import type { TrainingScheduleEntry } from './training';

export type ManagerSetupArea = 'training' | 'tactics';

export interface ManagerSetupStatus {
  isTrainingConfigured: boolean;
  isTacticsConfigured: boolean;
  isReadyToAdvance: boolean;
  blockingReasons: string[];
}

export interface CoachSetupRecommendation {
  id: string;
  kind: ManagerSetupArea;
  authorStaffId: number | null;
  authorName: string;
  authorRole: StaffRole | null;
  headline: string;
  summary: string;
  reasons: string[];
  payload: TrainingScheduleEntry[] | Omit<TeamTactics, 'teamId'>;
}
