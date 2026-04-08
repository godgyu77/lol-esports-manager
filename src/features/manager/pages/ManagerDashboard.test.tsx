import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { ManagerDashboard } from './ManagerDashboard';
import type { Team, Season, GameSave } from '../../../types';

vi.mock('../../../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));

vi.mock('../../../hooks/useNavBadges', () => ({
  useNavBadges: vi.fn().mockReturnValue({}),
}));

vi.mock('../../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

vi.mock('../../../components/CommandPalette', () => ({
  CommandPalette: () => null,
}));

vi.mock('../../../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

const mockTeam: Team = {
  id: 'team-1',
  name: 'T1',
  shortName: 'T1',
  region: 'LCK',
  budget: 5000000,
  reputation: 85,
  players: [],
} as unknown as Team;

describe('ManagerDashboard', () => {
  beforeEach(() => {
    resetStores();
  });

  it('사이드바와 내비게이션 그룹을 렌더링한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getAllByText('T1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('감독 겸 단장')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '매니저 내비게이션' })).toBeInTheDocument();
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('팀 운영')).toBeInTheDocument();
  });

  it('상단바에 시즌 날짜 예산 명성 정보를 표시한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getByText('2025 스프링')).toBeInTheDocument();
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('W3')).toBeInTheDocument();
    expect(screen.getByText('₩5,000,000')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('시즌 진행 버튼을 표시한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getAllByText('시즌 진행').length).toBeGreaterThanOrEqual(1);
  });

  it('하단 유틸리티 버튼을 표시한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getByText('저장 / 불러오기')).toBeInTheDocument();
    expect(screen.getByText('메인 메뉴')).toBeInTheDocument();
  });
});
