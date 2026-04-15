import { renderWithProviders, screen, resetStores, waitFor } from '../../test/testUtils';
import { SeasonGoalView } from './SeasonGoalView';
import { initializeNewGame } from '../../db/initGame';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../db/initGame', () => ({
  initializeNewGame: vi.fn(),
  loadGameIntoStore: vi.fn(),
}));

vi.mock('../../engine/save/saveEngine', () => ({
  getSaveSlots: vi.fn().mockResolvedValue([]),
}));

describe('SeasonGoalView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  const managerState = {
    mode: 'manager' as const,
    pendingTeamId: 'lck_T1',
    pendingManager: {
      name: 'Kim Coach',
      nationality: 'KR',
      age: 35,
      background: 'analyst' as const,
      reputation: 35,
      philosophy: { playerCare: 42, tacticalFocus: 72, resultDriven: 55, mediaFriendly: 38 },
      stats: { tacticalKnowledge: 13, motivation: 10, discipline: 11, adaptability: 14, scoutingEye: 14, mediaHandling: 10 },
    },
  };

  it('shows compact start guidance before detailed season briefing', async () => {
    renderWithProviders(<SeasonGoalView />, {
      gameState: managerState,
    });

    expect(await screen.findByText('빠른 시작')).toBeInTheDocument();
    expect(screen.getByText('시즌 목표를 확인하고 바로 시작하세요')).toBeInTheDocument();
    expect(screen.getByText('빠른 시작 체크')).toBeInTheDocument();
    expect(screen.getByText('상세 브리핑 보기')).toBeInTheDocument();
    expect(screen.getByTestId('seasongoal-first-session-route')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '이 목표로 시작' })).toBeInTheDocument();
  });

  it('shows a friendly lock message when new game initialization hits a DB lock', async () => {
    vi.mocked(initializeNewGame).mockRejectedValueOnce(
      new Error('error returned from database: (code: 5) database is locked'),
    );

    const { user } = renderWithProviders(<SeasonGoalView />, {
      gameState: managerState,
    });

    await waitFor(() => expect(screen.getByRole('button', { name: '이 목표로 시작' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '이 목표로 시작' }));

    expect(await screen.findByText('세이브 슬롯을 준비하는 중 잠금 충돌이 발생했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
  });
});
