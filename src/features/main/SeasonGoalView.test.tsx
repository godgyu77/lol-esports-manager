import { renderWithProviders, screen, resetStores } from '../../test/testUtils';
import { SeasonGoalView } from './SeasonGoalView';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../db/initGame', () => ({
  initializeNewGame: vi.fn(),
  loadGameIntoStore: vi.fn(),
}));

describe('SeasonGoalView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('shows board briefing and accept button', () => {
    renderWithProviders(<SeasonGoalView />, {
      gameState: {
        mode: 'manager',
        pendingTeamId: 'lck_T1',
        pendingManager: {
          name: 'Kim Coach',
          nationality: 'KR',
          age: 35,
          background: 'analyst',
          reputation: 35,
          philosophy: { playerCare: 42, tacticalFocus: 72, resultDriven: 55, mediaFriendly: 38 },
          stats: { tacticalKnowledge: 13, motivation: 10, discipline: 11, adaptability: 14, scoutingEye: 14, mediaHandling: 10 },
        },
      },
    });

    expect(screen.getByText('Arrival Briefing')).toBeInTheDocument();
    expect(screen.getByText('리스크와 보상')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시즌 목표 수락' })).toBeInTheDocument();
  });
});
