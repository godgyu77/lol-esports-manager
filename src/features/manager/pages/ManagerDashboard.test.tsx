import type { ReactNode } from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders, resetStores } from '../../../test/testUtils';
import { ManagerDashboard } from './ManagerDashboard';
import type { GameSave, Season, Team } from '../../../types';

const { mockGetInboxMessages, mockGetMainLoopRiskItems } = vi.hoisted(() => ({
  mockGetInboxMessages: vi.fn(),
  mockGetMainLoopRiskItems: vi.fn(),
}));

vi.mock('../../../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

vi.mock('../../../hooks/useNavBadges', () => ({
  useNavBadges: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../../../engine/inbox/inboxEngine', () => ({
  getInboxMessages: mockGetInboxMessages,
}));

vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getMainLoopRiskItems: mockGetMainLoopRiskItems,
}));

vi.mock('../../../components/CommandPalette', () => ({
  CommandPalette: () => null,
}));

vi.mock('../../../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('../../../utils/formatUtils', () => ({
  formatAmount: (value: number) => `₩${value.toLocaleString('ko-KR')}`,
}));

const mockSave = {
  id: 'save-1',
  userTeamId: 'team-1',
  seasonId: 'season-1',
  currentDate: '2025-01-15',
  managerName: '테스트 감독',
  mode: 'manager',
} as unknown as GameSave;

const mockSeason: Season = {
  id: 1,
  year: 2025,
  split: 'spring',
  currentDate: '2025-01-15',
  currentWeek: 3,
  endDate: '2025-06-30',
} as Season;

const mockTeam = {
  id: 'team-1',
  name: 'T1',
  shortName: 'T1',
  region: 'LCK',
  budget: 5000000,
  reputation: 85,
  roster: [],
  players: [],
} as unknown as Team;

describe('ManagerDashboard', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetMainLoopRiskItems.mockResolvedValue([]);
  });

  it('renders the dashboard shell with team and season summary', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getAllByText('T1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('W3')).toBeInTheDocument();
    expect(screen.getByText('₩5,000,000')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('renders a three-card priority strip on match days', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam], dayType: 'match_day' },
      routerProps: { initialEntries: ['/manager'] },
    });

    const strip = screen.getByTestId('managerdashboard-priority-strip');
    expect(strip).toBeInTheDocument();
    expect(within(strip).getAllByRole('button')).toHaveLength(3);
  });

  it('surfaces the latest match follow-up in the priority strip', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 1,
        teamId: 'team-1',
        type: 'general',
        title: 'Latest match follow-up',
        content: 'Review the draft plan before the rematch.',
        isRead: false,
        createdAt: '2025-01-15T10:00:00.000Z',
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
      },
    ]);

    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(await screen.findByText('Review the draft plan before the rematch.')).toBeInTheDocument();
  });

  it('falls back to the top loop risk when there is no match follow-up', async () => {
    mockGetMainLoopRiskItems.mockResolvedValue([
      {
        title: 'Board confidence warning',
        summary: 'The board is watching recent budget calls very closely.',
        tone: 'risk',
      },
    ]);

    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect((await screen.findAllByText('Board confidence warning')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('The board is watching recent budget calls very closely.').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps the compact priority strip visible alongside async dashboard data', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 2,
        teamId: 'team-1',
        type: 'general',
        title: 'Immediate follow-up',
        content: 'Stabilize the roster before the next stage match.',
        isRead: false,
        createdAt: '2025-01-15T12:00:00.000Z',
        actionRoute: '/manager/roster',
        relatedId: 'match_result:match-2',
      },
    ]);

    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    const strip = await screen.findByTestId('managerdashboard-priority-strip');
    expect(strip).toBeInTheDocument();
    expect(within(strip).getAllByRole('button')).toHaveLength(3);
    expect(await screen.findByText('Stabilize the roster before the next stage match.')).toBeInTheDocument();
  });

  it('shows a first-season retention banner on the dashboard shell', async () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(await screen.findByTestId('managerdashboard-retention-panel')).toBeInTheDocument();
    expect(screen.getByText('첫 시즌 몰입 포인트')).toBeInTheDocument();
  });
});
