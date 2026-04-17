import { renderWithProviders, screen, resetStores } from '../../../test/testUtils';
import { ManagerHome } from './ManagerHome';
import type { Team } from '../../../types/team';

const {
  mockNavigate,
  mockGetMatchesByTeam,
  mockGetUnreadCount,
  mockGetBudgetPressureSnapshot,
  mockGetMainLoopRiskItems,
  mockGetBoardExpectations,
  mockGetInboxMessages,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetMatchesByTeam: vi.fn(),
  mockGetUnreadCount: vi.fn(),
  mockGetBudgetPressureSnapshot: vi.fn(),
  mockGetMainLoopRiskItems: vi.fn(),
  mockGetBoardExpectations: vi.fn(),
  mockGetInboxMessages: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../hooks/useBgm', () => ({ useBgm: vi.fn() }));
vi.mock('../../tutorial/TutorialOverlay', () => ({ TutorialOverlay: () => null }));
vi.mock('../../../db/queries', () => ({
  getMatchesByTeam: mockGetMatchesByTeam,
}));
vi.mock('../../../engine/board/boardEngine', () => ({ getBoardExpectations: mockGetBoardExpectations }));
vi.mock('../../../engine/inbox/inboxEngine', () => ({ getInboxMessages: mockGetInboxMessages }));
vi.mock('../../../engine/news/newsEngine', () => ({ getUnreadCount: mockGetUnreadCount }));
vi.mock('../../../engine/manager/systemDepthEngine', () => ({
  getBudgetPressureSnapshot: mockGetBudgetPressureSnapshot,
  getMainLoopRiskItems: mockGetMainLoopRiskItems,
}));

const teams: Team[] = [
  { id: 'lck_T1', name: 'T1', shortName: 'T1', region: 'LCK', budget: 500000, salaryCap: 400000, reputation: 85, roster: [], playStyle: 'controlled' },
  { id: 'lck_GEN', name: 'Gen.G', shortName: 'GEN', region: 'LCK', budget: 450000, salaryCap: 400000, reputation: 84, roster: [], playStyle: 'controlled' },
];

const baseProps = {
  gameState: {
    save: {
      id: 1,
      metadataId: 1,
      mode: 'manager' as const,
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
      split: 'spring' as const,
      currentDate: '2026-03-01',
      currentWeek: 1,
      startDate: '2026-01-01',
      endDate: '2026-06-01',
      isActive: true,
    },
    teams,
  },
  settingsState: { tutorialComplete: true },
};

describe('ManagerHome', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    mockGetMatchesByTeam.mockResolvedValue([
      {
        id: 1,
        seasonId: 1,
        teamHomeId: 'lck_T1',
        teamAwayId: 'lck_GEN',
        scoreHome: 0,
        scoreAway: 0,
        isPlayed: false,
        games: [],
        matchType: 'regular',
        boFormat: 'Bo3',
        matchDate: '2026-03-03',
      },
    ]);
    mockGetUnreadCount.mockResolvedValue(2);
    mockGetBoardExpectations.mockResolvedValue({ satisfaction: 60 });
    mockGetInboxMessages.mockResolvedValue([]);
    mockGetBudgetPressureSnapshot.mockResolvedValue({
      totalPayroll: 0,
      salaryCap: 0,
      pressureLevel: 'watch',
      topDrivers: ['최근 지출 흐름을 다시 점검해야 합니다.'],
    });
    mockGetMainLoopRiskItems.mockResolvedValue([
      { title: '재정 압박', summary: '최근 지출 흐름을 다시 점검해야 합니다.', tone: 'risk' },
    ]);
  });

  it('renders the main loop summary cards and spotlight panel', async () => {
    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByText('60/100')).toBeInTheDocument();
    expect(screen.getByTestId('managerhome-priority-strip')).toBeInTheDocument();
    expect(screen.getByText('오늘 할 일')).toBeInTheDocument();
    expect(screen.getByTestId('managerhome-spotlight-panel')).toBeInTheDocument();
  });

  it('prioritizes the latest match follow-up on the home loop when inbox has a result memo', async () => {
    mockGetInboxMessages.mockResolvedValue([
      {
        id: 21,
        teamId: 'lck_T1',
        category: 'general',
        title: '[경기 결과] GEN전',
        content: '다음 권장 행동은 전술 재검토입니다.',
        isRead: false,
        actionRequired: true,
        actionRoute: '/manager/tactics',
        relatedId: 'match_result:match-1',
        createdDate: '2026-03-02',
        dismissOnRead: false,
        sticky: true,
      },
    ]);

    renderWithProviders(<ManagerHome />, baseProps);

    expect((await screen.findAllByText('방금 경기 정리')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/다음 권장 행동은 전술 재검토입니다./).length).toBeGreaterThan(0);
  });

  it('shows a spotlight choice that nudges exploration beyond the urgent loop', async () => {
    renderWithProviders(<ManagerHome />, baseProps);

    expect(await screen.findByTestId('managerhome-spotlight-panel')).toBeInTheDocument();
    expect(screen.getByText('오늘 가장 먼저 읽을 것')).toBeInTheDocument();
  });

  it('routes top board pressure notes to finance from the home loop', async () => {
    mockGetMainLoopRiskItems.mockResolvedValue([
      {
        title: '보드 신뢰 경고',
        summary: '보드가 최근 운영 선택과 예산 압박을 예의주시하고 있습니다.',
        tone: 'risk',
      },
    ]);

    renderWithProviders(<ManagerHome />, baseProps);

    expect((await screen.findAllByText('보드 신뢰 경고')).length).toBeGreaterThanOrEqual(1);
  });
});
