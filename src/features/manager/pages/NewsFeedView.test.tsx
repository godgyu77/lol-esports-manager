import { act } from 'react';
import { renderWithProviders, screen, waitFor, resetStores } from '../../../test/testUtils';
import { NewsFeedView } from './NewsFeedView';
import type { NewsArticle } from '../../../types/news';

const { mockGetRecentNews, mockGetUnreadCount, mockMarkAllAsRead, mockMarkAsRead, mockInvalidateNewsBadges } = vi.hoisted(() => ({
  mockGetRecentNews: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockInvalidateNewsBadges: vi.fn(),
}));

vi.mock('../../../engine/news/newsEngine', () => ({
  getRecentNews: mockGetRecentNews,
  getUnreadCount: mockGetUnreadCount,
  markAllAsRead: mockMarkAllAsRead,
  markAsRead: mockMarkAsRead,
}));

vi.mock('../../../engine/news/newsEvents', () => ({
  invalidateNewsBadges: mockInvalidateNewsBadges,
}));

const mockArticles: NewsArticle[] = [
  {
    id: 1,
    seasonId: 1,
    articleDate: '2026-03-01',
    category: 'match_result',
    title: 'T1, 개막전에서 완승',
    content: 'T1이 개막전에서 완승을 거두며 좋은 출발을 알렸다.\n\n라인전부터 주도권을 잡았고, 오브젝트 운영에서도 우위를 보였다.',
    importance: 2,
    isRead: false,
    relatedTeamId: 'lck_T1',
    relatedPlayerId: null,
  },
  {
    id: 2,
    seasonId: 1,
    articleDate: '2026-03-01',
    category: 'interview',
    title: '감독 인터뷰: 운영 완성도가 올라왔다',
    content: '경기 후 감독은 운영 완성도가 눈에 띄게 좋아졌다고 평가했다.',
    importance: 1,
    isRead: true,
    relatedTeamId: 'lck_T1',
    relatedPlayerId: null,
  },
];

describe('NewsFeedView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetRecentNews.mockResolvedValue(mockArticles);
    mockGetUnreadCount.mockResolvedValue(1);
    mockMarkAllAsRead.mockResolvedValue(undefined);
    mockMarkAsRead.mockResolvedValue(undefined);
  });

  it('opens a dedicated article reader when an article is selected', async () => {
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

    expect(await screen.findByText('뉴스 센터')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'T1, 개막전에서 완승' })).toBeInTheDocument();
    expect(await screen.findByText('데스크 메모')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: '뉴스 기사 열기: 감독 인터뷰: 운영 완성도가 올라왔다' }).click();
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '감독 인터뷰: 운영 완성도가 올라왔다' })).toBeInTheDocument();
      expect(screen.getByText('함께 읽을 기사')).toBeInTheDocument();
      expect(screen.getByText('현장 발언과 분위기를 통해 다음 경기의 힌트를 얻을 수 있습니다.')).toBeInTheDocument();
    });
  });
});
