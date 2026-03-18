export type NewsCategory =
  | 'match_result'      // 경기 결과
  | 'transfer_rumor'    // 이적 루머
  | 'player_complaint'  // 선수 불만
  | 'team_analysis'     // 팀 분석
  | 'interview'         // 인터뷰
  | 'social_media';     // SNS 반응

export interface NewsArticle {
  id: number;
  seasonId: number;
  articleDate: string;
  category: NewsCategory;
  title: string;
  content: string;
  relatedTeamId: string | null;
  relatedPlayerId: string | null;
  importance: number;
  isRead: boolean;
}

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  match_result: '경기 결과',
  transfer_rumor: '이적 루머',
  player_complaint: '선수 동향',
  team_analysis: '팀 분석',
  interview: '인터뷰',
  social_media: 'SNS',
};
