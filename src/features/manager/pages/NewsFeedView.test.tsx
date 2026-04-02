import { act } from 'react';
import { renderWithProviders, screen, waitFor, within, resetStores } from '../../../test/testUtils';
import { NewsFeedView } from './NewsFeedView';
import type { NewsArticle } from '../../../types/news';

const {
  mockGetRecentNews,
  mockGetUnreadBriefings,
  mockGetUnreadCount,
  mockMarkAllAsRead,
  mockMarkAsRead,
  mockGetArticleSummary,
} = vi.hoisted(() => ({
  mockGetRecentNews: vi.fn(),
  mockGetUnreadBriefings: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockGetArticleSummary: vi.fn((article: NewsArticle) => article.content.slice(0, 40)),
}));

vi.mock('../../../engine/news/newsEngine', () => ({
  getRecentNews: mockGetRecentNews,
  getUnreadBriefings: mockGetUnreadBriefings,
  getUnreadCount: mockGetUnreadCount,
  markAllAsRead: mockMarkAllAsRead,
  markAsRead: mockMarkAsRead,
  getArticleSummary: mockGetArticleSummary,
}));

const briefingArticle: NewsArticle = {
  id: 1,
  seasonId: 1,
  articleDate: '2026-03-01',
  category: 'coach_briefing',
  title: '코치 브리핑',
  content: '코치가 최근 훈련과 전술 방향을 정리했습니다.',
  importance: 2,
  isRead: false,
  relatedTeamId: 'lck_T1',
  relatedPlayerId: null,
  presentation: 'briefing',
  isDismissible: true,
};

const featureArticle: NewsArticle = {
  id: 2,
  seasonId: 1,
  articleDate: '2026-03-01',
  category: 'match_result',
  title: 'T1 승리',
  content: 'T1이 개막전에서 강한 운영으로 승리했습니다.\n\n라인전과 교전에서 우위를 유지했습니다.',
  importance: 3,
  isRead: false,
  relatedTeamId: 'lck_T1',
  relatedPlayerId: null,
  presentation: 'feature',
  isDismissible: false,
};

describe('NewsFeedView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetUnreadBriefings.mockResolvedValue([briefingArticle]);
    mockGetRecentNews.mockImplementation(async (_seasonId: number, _limit: number, _offset: number, category?: string) => {
      if (category === 'coach_briefing') return [briefingArticle];
      return [featureArticle];
    });
    mockGetUnreadCount.mockResolvedValue(1);
    mockMarkAllAsRead.mockResolvedValue(undefined);
    mockMarkAsRead.mockResolvedValue(undefined);
  });

  it('keeps articles in the list after read and only clears unread state', async () => {
    renderWithProviders(<NewsFeedView />, {
      gameState: {
        season: {
          id: 1,
          year: 2026,
          split: 'spring',
          currentDate: '2026-03-01',
          currentWeek: 1,
          endDate: '2026-06-01',
        },
      },
    });

    expect(await screen.findByText('뉴스 피드')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '뉴스 기사 열기: T1 승리' })).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: '뉴스 기사 열기: T1 승리' }).click();
    });

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith(2);
      expect(screen.getByRole('button', { name: '뉴스 기사 열기: T1 승리' })).toBeInTheDocument();
    });
  });

  it('shows unread briefings only in briefing mode', async () => {
    renderWithProviders(<NewsFeedView />, {
      gameState: {
        season: {
          id: 1,
          year: 2026,
          split: 'spring',
          currentDate: '2026-03-01',
          currentWeek: 1,
          endDate: '2026-06-01',
        },
      },
    });

    await screen.findByText('뉴스 피드');

    await act(async () => {
      screen.getByRole('tab', { name: '미확인 브리핑' }).click();
    });

    expect(await screen.findByRole('button', { name: '뉴스 기사 열기: 코치 브리핑' })).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: '뉴스 기사 열기: 코치 브리핑' }).click();
    });

    mockGetUnreadBriefings.mockResolvedValue([]);

    await act(async () => {
      screen.getByRole('tab', { name: '전체 기사' }).click();
    });

    await act(async () => {
      screen.getByRole('tab', { name: '미확인 브리핑' }).click();
    });

    await waitFor(() => {
      expect(screen.getByText('읽지 않은 브리핑이 없습니다.')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation across news filters', async () => {
    const { user } = renderWithProviders(<NewsFeedView />, {
      gameState: {
        season: {
          id: 1,
          year: 2026,
          split: 'spring',
          currentDate: '2026-03-01',
          currentWeek: 1,
          endDate: '2026-06-01',
        },
      },
    });

    await screen.findByRole('tablist');

    const toolbar = screen.getByRole('tablist');
    const buttons = within(toolbar).getAllByRole('tab');

    buttons[0].focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => {
      expect(buttons[1]).toHaveFocus();
      expect(buttons[1]).toHaveClass('fm-tab--active');
    });
  });
});
