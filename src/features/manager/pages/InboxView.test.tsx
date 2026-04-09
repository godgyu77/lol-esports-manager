import { act } from 'react';
import { renderWithProviders, screen, waitFor, within, resetStores } from '../../../test/testUtils';
import { InboxView } from './InboxView';
import type { InboxMessage } from '../../../types/inbox';

const {
  mockGetInboxMessages,
  mockGetUnreadInboxCount,
  mockMarkInboxRead,
  mockMarkAllInboxRead,
} = vi.hoisted(() => ({
  mockGetInboxMessages: vi.fn(),
  mockGetUnreadInboxCount: vi.fn(),
  mockMarkInboxRead: vi.fn(),
  mockMarkAllInboxRead: vi.fn(),
}));

vi.mock('../../../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
  getUnreadInboxCount: mockGetUnreadInboxCount,
  markInboxRead: mockMarkInboxRead,
  markAllInboxRead: mockMarkAllInboxRead,
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
  content: '코치가 확인할 내용을 보냈습니다.',
  isRead: false,
  actionRequired: false,
  actionRoute: null,
  relatedId: null,
  createdDate: '2026-03-01',
  dismissOnRead: true,
  sticky: false,
};

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
  });

  it('keeps messages in the default list after read and only clears unread state', async () => {
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
      },
    });

    expect(await screen.findByText('새 브리핑')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('새 브리핑').click();
    });

    await waitFor(() => {
      expect(mockMarkInboxRead).toHaveBeenCalledWith(11);
      expect(screen.getByText('새 브리핑')).toBeInTheDocument();
    });
  });

  it('shows empty state only in unread-only mode after a message is read', async () => {
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
      },
    });

    expect(await screen.findByText('새 브리핑')).toBeInTheDocument();

    await act(async () => {
      screen.getByText('새 브리핑').click();
    });

    await act(async () => {
      screen.getByRole('button', { name: '미확인 메시지만 보기' }).click();
    });

    await waitFor(() => {
      expect(screen.getByText('읽지 않은 메시지가 없습니다')).toBeInTheDocument();
    });
  });

  it('supports keyboard navigation across inbox filters', async () => {
    const { user } = renderWithProviders(<InboxView />, {
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
