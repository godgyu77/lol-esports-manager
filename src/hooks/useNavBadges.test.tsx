import { renderWithProviders, resetStores, screen, waitFor } from '../test/testUtils';
import { useNavBadges } from './useNavBadges';

const {
  mockGetUnreadCount,
  mockGetUnreadInboxCount,
  mockGetActiveComplaints,
  mockGetPendingReports,
  mockGetTeamTransferOffers,
  mockGetInboxMessages,
} = vi.hoisted(() => ({
  mockGetUnreadCount: vi.fn(),
  mockGetUnreadInboxCount: vi.fn(),
  mockGetActiveComplaints: vi.fn(),
  mockGetPendingReports: vi.fn(),
  mockGetTeamTransferOffers: vi.fn(),
  mockGetInboxMessages: vi.fn(),
}));

vi.mock('../engine/news/newsEngine', () => ({
  getUnreadCount: mockGetUnreadCount,
}));

vi.mock('../engine/complaint/complaintEngine', () => ({
  getActiveComplaints: mockGetActiveComplaints,
}));

vi.mock('../engine/scouting/scoutingEngine', () => ({
  getPendingReports: mockGetPendingReports,
}));

vi.mock('../engine/economy/transferEngine', () => ({
  getTeamTransferOffers: mockGetTeamTransferOffers,
}));

vi.mock('../engine/inbox/inboxEngine', () => ({
  getUnreadInboxCount: mockGetUnreadInboxCount,
  getInboxMessages: mockGetInboxMessages,
}));

function BadgeProbe({ userTeamId, seasonId }: { userTeamId: string; seasonId: number }) {
  const badges = useNavBadges(userTeamId, seasonId);
  return <pre data-testid="badges">{JSON.stringify(badges)}</pre>;
}

describe('useNavBadges', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetUnreadCount.mockResolvedValue(0);
    mockGetUnreadInboxCount.mockResolvedValue(0);
    mockGetActiveComplaints.mockResolvedValue([]);
    mockGetPendingReports.mockResolvedValue([]);
    mockGetTeamTransferOffers.mockResolvedValue({ sent: [], received: [] });
    mockGetInboxMessages.mockResolvedValue([]);
  });

  it('adds a badge for the latest match follow-up route alongside other nav counts', async () => {
    mockGetUnreadCount.mockResolvedValue(2);
    mockGetUnreadInboxCount.mockResolvedValue(3);
    mockGetActiveComplaints.mockResolvedValue([{ id: 'complaint-1' }]);
    mockGetPendingReports.mockResolvedValue([{ id: 'scout-1', daysRemaining: 0 }]);
    mockGetTeamTransferOffers.mockResolvedValue({
      sent: [],
      received: [{ id: 'offer-1', status: 'pending' }],
    });
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

    renderWithProviders(<BadgeProbe userTeamId="team-1" seasonId={1} />);

    await waitFor(() => {
      const badges = JSON.parse(screen.getByTestId('badges').textContent ?? '{}');
      expect(badges['/manager/news']).toBe(2);
      expect(badges['/manager/inbox']).toBe(3);
      expect(badges['/manager/complaints']).toBe(1);
      expect(badges['/manager/scouting']).toBe(1);
      expect(badges['/manager/transfer']).toBe(1);
      expect(badges['/manager/tactics']).toBe(1);
    });
  });

  it('falls back to the inbox route when the follow-up memo has no route', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 1,
        teamId: 'team-1',
        type: 'general',
        title: '[경기 결과] T1 vs GEN',
        content: '다음 권장 행동은 전술 재검토입니다.',
        isRead: false,
        createdAt: '2026-03-01T10:00:00.000Z',
        actionRoute: null,
        relatedId: 'match_result:match-1',
      },
    ]);

    renderWithProviders(<BadgeProbe userTeamId="team-1" seasonId={1} />);

    await waitFor(() => {
      const badges = JSON.parse(screen.getByTestId('badges').textContent ?? '{}');
      expect(badges['/manager/inbox']).toBe(1);
      expect(badges['/manager/tactics']).toBeUndefined();
    });
  });
});
