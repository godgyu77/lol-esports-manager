import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { ManagerDashboard } from './ManagerDashboard';
import type { Team, Season, GameSave } from '../../../types';

// 외부 의존성 모킹
vi.mock('../../../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn(),
}));
vi.mock('../../../hooks/useNavBadges', () => ({
  useNavBadges: vi.fn().mockReturnValue({}),
}));
vi.mock('../../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));
vi.mock('../../../engine/season/dayAdvancer', () => ({
  advanceDay: vi.fn().mockResolvedValue({ nextDate: '2025-01-16', date: '2025-01-15', dayType: 'training', hasUserMatch: false }),
  skipToNextMatchDay: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../components/CommandPalette', () => ({
  CommandPalette: () => null,
}));
vi.mock('../../../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../../../utils/formatUtils', () => ({
  formatAmount: (v: number) => `₩${v}`,
}));

const mockSave: GameSave = {
  id: 'save-1',
  userTeamId: 'team-1',
  seasonId: 'season-1',
  currentDate: '2025-01-15',
  managerName: '테스트 감독',
  mode: 'manager',
} as GameSave;

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

  it('사이드바에 팀 이름과 네비게이션 그룹을 렌더한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    // 팀 이름이 로고/이름 양쪽에 존재
    expect(screen.getAllByText('T1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('감독 모드')).toBeInTheDocument();

    // 사이드바 네비게이션 영역에서 확인
    const sidebar = screen.getByRole('navigation', { name: '주 메뉴' });
    expect(sidebar).toBeInTheDocument();
    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('로스터')).toBeInTheDocument();
    expect(screen.getByText('이적 시장')).toBeInTheDocument();
  });

  it('상단바에 시즌/날짜/예산/리전 정보를 표시한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getByText('2025 Spring')).toBeInTheDocument();
    expect(screen.getByText('2025-01-15')).toBeInTheDocument();
    expect(screen.getByText('W3')).toBeInTheDocument();
    expect(screen.getByText('₩5000000')).toBeInTheDocument();
    expect(screen.getByText('LCK')).toBeInTheDocument();
  });

  it('"시즌 진행" 버튼이 존재한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getByText('▶ 시즌 진행')).toBeInTheDocument();
  });

  it('시즌 진행 버튼 클릭 시 모달을 표시한다', async () => {
    const { user } = renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    await user.click(screen.getByText('▶ 시즌 진행'));

    expect(screen.getByText('다음 날 →')).toBeInTheDocument();
    expect(screen.getByText('경기일까지 스킵')).toBeInTheDocument();
    // 모달 내 활동 버튼 (사이드바에도 '훈련' 링크가 있으므로 getAllByText 사용)
    expect(screen.getByText('휴식')).toBeInTheDocument();
    expect(screen.getByText('스크림')).toBeInTheDocument();
  });

  it('사이드바 푸터 버튼이 존재한다', () => {
    renderWithProviders(<ManagerDashboard />, {
      gameState: { save: mockSave, season: mockSeason, teams: [mockTeam] },
      routerProps: { initialEntries: ['/manager'] },
    });

    expect(screen.getByText('저장/불러오기')).toBeInTheDocument();
    expect(screen.getByText('설정')).toBeInTheDocument();
    expect(screen.getByText('메인 메뉴')).toBeInTheDocument();
  });
});
