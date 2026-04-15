import { act } from 'react';
import { renderWithProviders, screen, waitFor, within, resetStores } from '../../../test/testUtils';
import { NewsFeedView } from './NewsFeedView';
import type { NewsArticle } from '../../../types/news';
import type { GameSave } from '../../../types';
import { localizeEntityNamesInText } from '../../../utils/displayName';

const {
  mockNavigate,
  mockGetRecentNews,
  mockGetUnreadBriefings,
  mockGetUnreadCount,
  mockMarkAllAsRead,
  mockMarkAsRead,
  mockGetArticleSummary,
  mockGetInboxMessages,
  mockGetMainLoopRiskItems,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetRecentNews: vi.fn(),
  mockGetUnreadBriefings: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockMarkAllAsRead: vi.fn(),
  mockMarkAsRead: vi.fn(),
  mockGetArticleSummary: vi.fn((article: NewsArticle) => article.content.slice(0, 40)),
  mockGetInboxMessages: vi.fn(),
  mockGetMainLoopRiskItems: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
  it('uses top loop risk routing in the spotlight panel when no match follow-up exists', async () => {
    mockGetMainLoopRiskItems.mockResolvedValue([
      {
        title: '국제전 압박',
        summary: '이번 시리즈는 시즌 평가를 바꿀 수 있어 프리매치 점검이 필요합니다.',
        tone: 'risk',
      },
    ]);

    renderNewsFeed();

    expect(await screen.findByText('국제전 압박 점검')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: '리스크 바로 보기' }).click();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/manager/pre-match');
  });
});

vi.mock('../../../engine/news/newsEngine', () => ({
  getRecentNews: mockGetRecentNews,
  getUnreadBriefings: mockGetUnreadBriefings,
  getUnreadCount: mockGetUnreadCount,
  markAllAsRead: mockMarkAllAsRead,
  markAsRead: mockMarkAsRead,
  getArticleSummary: mockGetArticleSummary,
}));

vi.mock('../../../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getMainLoopRiskItems: mockGetMainLoopRiskItems,
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

const taggedArticle: NewsArticle = {
  id: 3,
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

function renderNewsFeed() {
  return renderWithProviders(<NewsFeedView />, {
    gameState: {
      season: seasonState,
      save: ({
        id: 1,
        userTeamId: 'lck_T1',
        seasonId: 'season-1',
        currentDate: '2026-03-01',
        managerName: 'Test Manager',
        mode: 'manager',
        metadataId: 1,
        currentSeasonId: 1,
        dbFilename: 'test.db',
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
        slotNumber: 1,
        saveName: 'Test Save',
        playTimeMinutes: 0,
      } as unknown as GameSave),
    },
  });
}

describe('NewsFeedView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetUnreadBriefings.mockResolvedValue([briefingArticle]);
    mockGetRecentNews.mockImplementation(async (_seasonId: number, _limit: number, _offset: number, category?: string) => {
      if (category === 'coach_briefing') return [briefingArticle];
      return [featureArticle, taggedArticle];
    });
    mockGetUnreadCount.mockResolvedValue(1);
    mockMarkAllAsRead.mockResolvedValue(undefined);
    mockMarkAsRead.mockResolvedValue(undefined);
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetMainLoopRiskItems.mockResolvedValue([]);
  });

  it('keeps articles in the list after read and only clears unread state', async () => {
    renderNewsFeed();

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
    renderNewsFeed();

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
    const { user } = renderNewsFeed();

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

  it('keeps the selected reader content visible for a highlighted article', async () => {
    renderNewsFeed();

    await screen.findByRole('heading', { level: 1 });

    await act(async () => {
      screen.getByRole('button', { name: articleButtonName(taggedArticle.title) }).click();
    });

    expect(screen.getAllByText(localizeEntityNamesInText(taggedArticle.title)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(localizeEntityNamesInText(taggedArticle.content)).length).toBeGreaterThan(0);
  });

  it('shows a spotlight read panel that suggests the next narrative click', async () => {
    renderNewsFeed();

    expect(await screen.findByTestId('news-spotlight-panel')).toBeInTheDocument();
    expect(screen.getByText('오늘 더 파고들 선택')).toBeInTheDocument();
    expect(screen.getByText(/오늘 화제인 기사 따라가기|오늘 팀 분위기 둘러보기/)).toBeInTheDocument();
  });
});
