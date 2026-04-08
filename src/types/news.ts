export type NewsCategory =
  | 'match_result'
  | 'transfer_rumor'
  | 'player_complaint'
  | 'team_analysis'
  | 'interview'
  | 'social_media'
  | 'injury_report'
  | 'transfer_complete'
  | 'scandal'
  | 'fan_reaction'
  | 'award_news'
  | 'patch_notes'
  | 'coach_briefing';

export type NewsPresentation = 'briefing' | 'feature';

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
  presentation: NewsPresentation;
  isDismissible: boolean;
  narrativeTags: string[];
}

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  match_result: '경기 결과',
  transfer_rumor: '이적 루머',
  player_complaint: '선수 이슈',
  team_analysis: '팀 분석',
  interview: '인터뷰',
  social_media: 'SNS',
  injury_report: '부상 보고',
  transfer_complete: '이적 확정',
  scandal: '사건 사고',
  fan_reaction: '팬 반응',
  award_news: '수상',
  patch_notes: '패치 노트',
  coach_briefing: '코치 브리핑',
};
