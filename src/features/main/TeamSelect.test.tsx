import { renderWithProviders, screen, resetStores } from '../../test/testUtils';
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

  it('shows team briefing details after choosing a team', async () => {
    const { user } = renderWithProviders(<TeamSelect />, { gameState: { mode: 'manager' } });
    await user.click(screen.getByRole('button', { name: /T1/i }));
    expect(screen.getByText('팀 입단 브리핑')).toBeInTheDocument();
    expect(screen.getByText(/추천 유저/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이 팀으로 부임 준비' })).toBeInTheDocument();
  });
});
