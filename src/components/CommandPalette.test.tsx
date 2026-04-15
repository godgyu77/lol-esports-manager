import { act } from 'react';
import { renderWithProviders, resetStores, screen, waitFor } from '../test/testUtils';
import { CommandPalette } from './CommandPalette';

const { mockNavigate, mockGetInboxMessages, mockGetMainLoopRiskItems } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetInboxMessages: vi.fn(),
  mockGetMainLoopRiskItems: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
}));

vi.mock('../engine/manager/systemDepthEngine', () => ({
  getMainLoopRiskItems: mockGetMainLoopRiskItems,
}));

describe('CommandPalette', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetMainLoopRiskItems.mockResolvedValue([]);
  });

  it('surfaces the latest match follow-up as the top quick action', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 1,
        teamId: 'team-1',
        type: 'general',
        title: '[경기 결과] T1 vs GEN',
        content: '다음 권장 행동은 전술 재검토입니다.',
        isRead: false,
        createdAt: '2026-03-01T10:00:00.000Z',
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
      },
    ]);

    renderWithProviders(<CommandPalette isOpen onClose={vi.fn()} />, {
      gameState: {
        save: {
          id: 1,
          metadataId: 1,
          mode: 'manager',
          userTeamId: 'team-1',
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

    const action = await screen.findByText('방금 경기 정리');
    expect(action).toBeInTheDocument();

    await act(async () => {
      action.closest('.cmd-item')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/manager/tactics');
    });
  });

  it('falls back to top loop risks when there is no latest match follow-up', async () => {
    mockGetMainLoopRiskItems.mockResolvedValue([
      {
        title: '보드 신뢰 경고',
        summary: '보드가 최근 운영 선택을 재정 압박과 함께 보고 있습니다.',
        tone: 'risk',
      },
    ]);

    renderWithProviders(<CommandPalette isOpen onClose={vi.fn()} />, {
      gameState: {
        save: {
          id: 1,
          metadataId: 1,
          mode: 'manager',
          userTeamId: 'team-1',
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
      },
    });

    const action = await screen.findByText('보드 신뢰 점검');
    expect(action).toBeInTheDocument();

    await act(async () => {
      action.closest('.cmd-item')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/manager/finance');
    });
  });
});
