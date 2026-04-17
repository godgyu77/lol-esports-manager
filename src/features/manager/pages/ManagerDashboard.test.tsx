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
    expect(screen.getAllByText('₩5,000,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: '다음 진행' })).toBeInTheDocument();
  });

  it('renders a three-card priority strip', () => {
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
        title: '[경기 결과] T1 vs GEN',
        content: '리매치 전에 드래프트를 다시 점검해야 합니다.',
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

    expect(await screen.findByText('리매치 전에 드래프트를 다시 점검해야 합니다.')).toBeInTheDocument();
  });

  it('falls back to the top loop risk when there is no match follow-up', async () => {
    mockGetMainLoopRiskItems.mockResolvedValue([
      {
        title: '보드 신뢰 경고',
        summary: '최근 예산 집행을 보드가 예의주시하고 있습니다.',
        tone: 'risk',
      },
    ]);

    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect((await screen.findAllByText('보드 신뢰 경고')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('최근 예산 집행을 보드가 예의주시하고 있습니다.').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps only save/load and main menu buttons in the sidebar footer', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getByRole('button', { name: '저장 / 불러오기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '메인 메뉴' })).toBeInTheDocument();
  });
});
