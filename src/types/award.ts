export type AwardType =
  | 'mvp'           // 정규시즌 MVP
  | 'all_pro_1st'   // All-Pro 1st Team (포지션별)
  | 'all_pro_2nd'   // All-Pro 2nd Team
  | 'rookie_of_year' // 신인왕
  | 'pog'           // 경기 MVP (Player of the Game)
  | 'monthly_mvp';  // 월간 MVP

export interface Award {
  id: number;
  seasonId: number;
  awardType: AwardType;
  playerId: string | null;
  teamId: string | null;
  value: number | null;
  awardedDate: string;
}

export const AWARD_TYPE_LABELS: Record<AwardType, string> = {
  mvp: '정규시즌 MVP',
  all_pro_1st: 'All-Pro 1st Team',
  all_pro_2nd: 'All-Pro 2nd Team',
  rookie_of_year: '신인왕',
  pog: 'POG',
  monthly_mvp: '월간 MVP',
};
