export type RecordType = 'champion' | 'mvp' | 'all_pro' | 'most_kills' | 'most_wins' | 'longest_streak' | 'hall_of_fame';

export interface HallOfFameEntry {
  id: number;
  seasonId: number;
  recordType: RecordType;
  playerId: string | null;
  teamId: string | null;
  value: number | null;
  description: string | null;
  recordedDate: string;
}

export interface SeasonRecord {
  id: number;
  seasonId: number;
  teamId: string;
  finalStanding: number | null;
  wins: number;
  losses: number;
  playoffResult: string | null;
  champion: boolean;
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  champion: '우승',
  mvp: 'MVP',
  all_pro: 'All-Pro',
  most_kills: '최다 킬',
  most_wins: '최다 승',
  longest_streak: '최장 연승',
  hall_of_fame: '명예의 전당',
};
