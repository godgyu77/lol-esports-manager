export type CommunitySource = 'inven' | 'dcinside' | 'fmkorea' | 'reddit' | 'twitter';
export type CommentSentiment = 'positive' | 'neutral' | 'negative' | 'hype' | 'angry';
export type SocialEventType = 'transfer_rumor' | 'transfer_official' | 'staff_hire' | 'staff_fire' | 'match_result' | 'draft_pick';

export interface SocialReaction {
  id: number;
  seasonId: number;
  eventType: SocialEventType;
  eventDate: string;
  title: string;
  content: string;
  relatedTeamId: string | null;
  relatedPlayerId: string | null;
  relatedStaffId: number | null;
  communitySource: CommunitySource;
}

export interface SocialComment {
  id: number;
  reactionId: number;
  username: string;
  comment: string;
  likes: number;
  sentiment: CommentSentiment;
}

export const COMMUNITY_LABELS: Record<CommunitySource, string> = {
  inven: '인벤',
  dcinside: 'DC인사이드',
  fmkorea: 'FM코리아',
  reddit: 'Reddit',
  twitter: 'X (Twitter)',
};
