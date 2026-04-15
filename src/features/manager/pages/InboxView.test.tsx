import { act } from 'react';
import { renderWithProviders, screen, waitFor, within, resetStores } from '../../../test/testUtils';
import { InboxView } from './InboxView';
import type { InboxMessage } from '../../../types/inbox';

const {
  mockGetInboxMessages,
  mockGetUnreadInboxCount,
  mockMarkInboxRead,
  mockMarkAllInboxRead,
  mockSyncSystemInboxMemo,
  mockGetMainLoopRiskItems,
} = vi.hoisted(() => ({
  mockGetInboxMessages: vi.fn(),
  mockGetUnreadInboxCount: vi.fn(),
  mockMarkInboxRead: vi.fn(),
  mockMarkAllInboxRead: vi.fn(),
  mockSyncSystemInboxMemo: vi.fn(),
  mockGetMainLoopRiskItems: vi.fn(),
}));

vi.mock('../../../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
  getUnreadInboxCount: mockGetUnreadInboxCount,
  markInboxRead: mockMarkInboxRead,
  markAllInboxRead: mockMarkAllInboxRead,
  syncSystemInboxMemo: mockSyncSystemInboxMemo,
  getLatestMatchResultInboxMessage: (messages: InboxMessage[]) =>
    messages.find((message) => message.relatedId?.startsWith('match_result:') || message.title.startsWith('[경기 결과]')) ?? null,
  isMatchResultInboxMessage: (message: InboxMessage) =>
    Boolean(message.relatedId?.startsWith('match_result:') || message.title.startsWith('[경기 결과]')),
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getMainLoopRiskItems: mockGetMainLoopRiskItems,
}));

vi.mock('../../../ai/advancedAiService', () => ({
  generateFanLetter: vi.fn(),
}));

vi.mock('../../../db/queries', () => ({
  getStandings: vi.fn(),
  getMatchesByTeam: vi.fn(),
}));

const unreadMessage: InboxMessage = {
  id: 11,
  teamId: 'lck_T1',
  category: 'news',
  title: '새 브리핑',
  content: '코치가 확인할 브리핑이 도착했습니다.',
  isRead: false,
  actionRequired: false,
  actionRoute: null,
  relatedId: null,
  createdDate: '2026-03-01',
  dismissOnRead: true,
  sticky: false,
};

function renderInboxView() {
  return renderWithProviders(<InboxView />, {
    gameState: {
      save: {
        id: 1,
        metadataId: 1,
        mode: 'manager',
        userTeamId: 'lck_T1',
        currentSeasonId: 1,
        dbFilename: 'test.db',
        createdAt: '2026-03-01',
        updatedAt: '2026-03-01',
        slotNumber: 1,
        saveName: 'Test Save',
        playTimeMinutes: 0,
      },
    },
  });
}

describe('InboxView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetInboxMessages.mockImplementation(async (_teamId: string, _limit: number, unreadOnly = false) => {
      if (unreadOnly) return [];
      return [unreadMessage];
    });
    mockGetUnreadInboxCount.mockResolvedValue(1);
    mockMarkInboxRead.mockResolvedValue(undefined);
    mockMarkAllInboxRead.mockResolvedValue(undefined);
    mockSyncSystemInboxMemo.mockResolvedValue(false);
    mockGetMainLoopRiskItems.mockResolvedValue([]);
  });

  it('keeps messages in the default list after read and only clears unread state', async () => {
    renderInboxView();

    expect((await screen.findAllByText('새 브리핑')).length).toBeGreaterThan(0);

    await act(async () => {
      screen.getByRole('button', { name: /새 브리핑/ }).click();
    });

    await waitFor(() => {
      expect(mockMarkInboxRead).toHaveBeenCalledWith(11);
      expect(screen.getAllByText('새 브리핑').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state only in unread-only mode after a message is read', async () => {
    renderInboxView();

    expect((await screen.findAllByText('새 브리핑')).length).toBeGreaterThan(0);

    await act(async () => {
      screen.getByRole('button', { name: /새 브리핑/ }).click();
    });

    await act(async () => {
      screen.getByRole('button', { name: '미확인 메시지만 보기' }).click();
    });

    await waitFor(() => {
      expect(screen.getByText('읽지 않은 메시지가 없습니다')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation across inbox filters', async () => {
    const { user } = renderInboxView();

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

  it('shows a fallback system memo when the inbox list is empty', async () => {
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetUnreadInboxCount.mockResolvedValue(0);
    mockGetMainLoopRiskItems.mockResolvedValue([
      { title: '준비 체인 점검', summary: '최근 준비 실패가 다음 경기 메모로 이어지고 있습니다.', tone: 'risk' },
    ]);

    renderWithProviders(<InboxView />, {
      gameState: {
        save: {
          id: 1,
          metadataId: 1,
          mode: 'manager',
          userTeamId: 'lck_T1',
          currentSeasonId: 1,
          dbFilename: 'test.db',
          createdAt: '2026-03-01',
          updatedAt: '2026-03-01',
          slotNumber: 1,
          saveName: 'Test Save',
          playTimeMinutes: 0,
        },
        season: {
          id: 1,
          year: 2026,
          split: 'spring',
          currentDate: '2026-03-01',
          currentWeek: 1,
          startDate: '2026-01-01',
          endDate: '2026-06-01',
          isActive: true,
        },
        teams: [],
      },
    });

    expect(await screen.findByText('표시할 메시지가 없습니다')).toBeInTheDocument();
    expect(screen.getAllByText(/준비 체인 점검:/).length).toBeGreaterThan(0);
  });

  it('surfaces match result follow-up messages in the featured match panel', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 21,
        teamId: 'lck_T1',
        category: 'general',
        title: '[경기 결과] GEN전 0:2 패배',
        content: '다음 권장 행동은 전술 재정비입니다. 경기 초반 운영이 흔들렸습니다.',
        isRead: false,
        actionRequired: true,
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
        createdDate: '2026-03-02',
        dismissOnRead: false,
        sticky: true,
      },
    ]);
    mockGetUnreadInboxCount.mockResolvedValue(1);

    renderInboxView();

    expect(await screen.findByText('방금 경기 정리')).toBeInTheDocument();
    expect(screen.getAllByText('관리 메모').length).toBeGreaterThan(0);
    expect(screen.getAllByText('경기 결과 후속').length).toBeGreaterThan(0);
  });

  it('shows a spotlight read panel even when inbox browsing is the main task', async () => {
    renderInboxView();

    expect(await screen.findByTestId('inbox-spotlight-panel')).toBeInTheDocument();
    expect(screen.getByText('오늘 가장 재밌는 선택')).toBeInTheDocument();
    expect(screen.getByText(/지금 가서 읽어볼 브리핑|오늘 인박스에서 더 읽어볼 것|오늘 팀 분위기 둘러보기/)).toBeInTheDocument();
  });
});
