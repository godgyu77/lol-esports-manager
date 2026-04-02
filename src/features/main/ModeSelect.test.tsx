import { renderWithProviders, screen, resetStores } from '../../test/testUtils';
import { useGameStore } from '../../stores/gameStore';
import { ModeSelect } from './ModeSelect';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('ModeSelect', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('keeps player mode visible but blocks new player career starts', async () => {
    const { user } = renderWithProviders(<ModeSelect />);

    expect(screen.getByText('선수 모드')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /선수 모드/i }));

    expect(screen.getByText(/선수 모드 신규 시작은 아직 준비 중입니다/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(useGameStore.getState().mode).toBeNull();
  });

  it('starts manager mode normally', async () => {
    const { user } = renderWithProviders(<ModeSelect />);

    await user.click(screen.getByRole('button', { name: /감독 모드/i }));

    expect(useGameStore.getState().mode).toBe('manager');
    expect(mockNavigate).toHaveBeenCalledWith('/manager-create');
  });
});
