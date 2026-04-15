import { renderWithProviders, screen, resetStores } from '../../test/testUtils';
import { useGameStore } from '../../stores/gameStore';
import { TeamSelect } from './TeamSelect';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('TeamSelect', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('adds the team briefing panel after selecting a team', async () => {
    const { user } = renderWithProviders(<TeamSelect />, { gameState: { mode: 'manager' } });
    const initialButtonCount = screen.getAllByRole('button').length;

    await user.click(screen.getByRole('button', { name: /T1/i }));

    expect(screen.getAllByRole('button').length).toBeGreaterThan(initialButtonCount);
    expect(screen.getByRole('button', { name: /Bilibili Gaming/ })).toBeInTheDocument();
    expect(screen.getByTestId('teamselect-first-session-route')).toBeInTheDocument();
  });

  it('starts the onboarding flow from a featured starter path', async () => {
    const { user } = renderWithProviders(<TeamSelect />, { gameState: { mode: 'manager' } });

    await user.click(screen.getByRole('button', { name: /Bilibili Gaming/ }));
    await user.click(screen.getByRole('button', { name: '이 팀으로 빠르게 시작' }));

    expect(useGameStore.getState().pendingTeamId).toBeTruthy();
    expect(mockNavigate).toHaveBeenCalledWith('/season-goal');
  });
});
