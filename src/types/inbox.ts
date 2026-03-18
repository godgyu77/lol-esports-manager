export type InboxCategory = 'transfer' | 'contract' | 'complaint' | 'board' | 'news' | 'scouting' | 'injury' | 'promise' | 'general';

export interface InboxMessage {
  id: number;
  teamId: string;
  category: InboxCategory;
  title: string;
  content: string;
  isRead: boolean;
  actionRequired: boolean;
  actionRoute: string | null;
  relatedId: string | null;
  createdDate: string;
}

export const INBOX_CATEGORY_LABELS: Record<InboxCategory, string> = {
  transfer: '이적', contract: '계약', complaint: '선수 관리',
  board: '구단', news: '뉴스', scouting: '스카우팅',
  injury: '부상', promise: '약속', general: '일반',
};
