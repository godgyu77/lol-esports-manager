import { act } from 'react';
import { renderWithProviders, screen, waitFor, within, resetStores } from '../../../test/testUtils';
import { NewsFeedView } from './NewsFeedView';
import type { NewsArticle } from '../../../types/news';
import { localizeEntityNamesInText } from '../../../utils/displayName';

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
  title: 'Coach briefing',
  content: 'Coaches summarized the current training direction and opponent prep.',
  importance: 2,
  isRead: false,
  relatedTeamId: 'lck_T1',
  relatedPlayerId: null,
  presentation: 'briefing',
  isDismissible: true,
  narrativeTags: [],
};

const featureArticle: NewsArticle = {
  id: 2,
  seasonId: 1,
  articleDate: '2026-03-01',
  category: 'match_result',
  title: 'T1 secure a clean win',
  content: 'T1 controlled lanes well and converted that lead into a stable win.',
  importance: 3,
  isRead: false,
  relatedTeamId: 'lck_T1',
  relatedPlayerId: null,
  presentation: 'feature',
  isDismissible: false,
  narrativeTags: [],
};

const legacyArticle: NewsArticle = {
  id: 3,
  seasonId: 1,
  articleDate: '2026-03-02',
  category: 'team_analysis',
  title: 'Team outlook update',
  content: '왕조 서사와 국제전 압박이 동시에 커지고 있다.',
  importance: 2,
  isRead: true,
  relatedTeamId: 'lck_T1',
  relatedPlayerId: null,
  presentation: 'feature',
  isDismissible: false,
  narrativeTags: [],
};

const pressureArticle: NewsArticle = {
  id: 4,
  seasonId: 1,
  articleDate: '2026-03-03',
  category: 'team_analysis',
  title: 'Locker room watch',
  content: '팀 내부 압박과 위기가 동시에 커지고 있다.',
  importance: 1,
  isRead: true,
  relatedTeamId: 'lck_T1',
  relatedPlayerId: null,
  presentation: 'feature',
  isDismissible: false,
  narrativeTags: [],
};

const taggedArticle: NewsArticle = {
  id: 5,
  seasonId: 1,
  articleDate: '2026-03-03',
  category: 'team_analysis',
  title: 'Franchise desk memo',
  content: 'Stored tags should surface even when the copy is otherwise neutral.',
  importance: 2,
  isRead: true,
  relatedTeamId: 'lck_T1',
  relatedPlayerId: null,
  presentation: 'feature',
  isDismissible: false,
  narrativeTags: ['legacy', 'international'],
};

function articleButtonName(title: string) {
  return `뉴스 기사 열기: ${localizeEntityNamesInText(title)}`;
}

const seasonState = {
  id: 1,
  year: 2026,
  split: 'spring' as const,
  currentDate: '2026-03-01',
  currentWeek: 1,
  startDate: '2026-01-01',
  endDate: '2026-06-01',
  isActive: true,
};

describe('NewsFeedView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetUnreadBriefings.mockResolvedValue([briefingArticle]);
    mockGetRecentNews.mockImplementation(async (_seasonId: number, _limit: number, _offset: number, category?: string) => {
      if (category === 'coach_briefing') return [briefingArticle];
      return [featureArticle, legacyArticle, pressureArticle, taggedArticle];
    });
    mockGetUnreadCount.mockResolvedValue(1);
    mockMarkAllAsRead.mockResolvedValue(undefined);
    mockMarkAsRead.mockResolvedValue(undefined);
  });

  it('keeps articles in the list after read and only clears unread state', async () => {
    renderWithProviders(<NewsFeedView />, {
      gameState: { season: seasonState },
    });

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: articleButtonName(featureArticle.title) })).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: articleButtonName(featureArticle.title) }).click();
    });

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith(2);
      expect(screen.getByRole('button', { name: articleButtonName(featureArticle.title) })).toBeInTheDocument();
    });
  });

  it('shows unread briefings only in briefing mode', async () => {
    renderWithProviders(<NewsFeedView />, {
      gameState: { season: seasonState },
    });

    await screen.findByRole('heading', { level: 1 });
    const tabs = within(screen.getByRole('tablist')).getAllByRole('tab');

    await act(async () => {
      tabs[1].click();
    });

    expect(await screen.findByRole('button', { name: articleButtonName(briefingArticle.title) })).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: articleButtonName(briefingArticle.title) }).click();
    });

    mockGetUnreadBriefings.mockResolvedValue([]);

    await act(async () => {
      tabs[0].click();
    });

    await act(async () => {
      tabs[1].click();
    });

    expect(await screen.findByText('읽지 않은 브리핑이 없습니다.')).toBeInTheDocument();
  });

  it('supports keyboard navigation across news filters', async () => {
    const { user } = renderWithProviders(<NewsFeedView />, {
      gameState: { season: seasonState },
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

  it('surfaces Korean narrative badges for legacy and international articles', async () => {
    renderWithProviders(<NewsFeedView />, {
      gameState: { season: seasonState },
    });

    await screen.findByRole('heading', { level: 1 });

    await act(async () => {
      screen.getByRole('button', { name: articleButtonName(legacyArticle.title) }).click();
    });

    expect((await screen.findAllByText('전통')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('국제전').length).toBeGreaterThan(0);
  });

  it('detects pressure badges from Korean narrative copy', async () => {
    renderWithProviders(<NewsFeedView />, {
      gameState: { season: seasonState },
    });

    await screen.findByRole('heading', { level: 1 });

    await act(async () => {
      screen.getByRole('button', { name: articleButtonName(pressureArticle.title) }).click();
    });

    expect((await screen.findAllByText('압박')).length).toBeGreaterThan(0);
  });

  it('prefers stored narrative tags when articles already carry metadata', async () => {
    renderWithProviders(<NewsFeedView />, {
      gameState: { season: seasonState },
    });

    await screen.findByRole('heading', { level: 1 });

    await act(async () => {
      screen.getByRole('button', { name: articleButtonName(taggedArticle.title) }).click();
    });

    expect((await screen.findAllByText('전통')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('국제전').length).toBeGreaterThan(0);
  });
});
