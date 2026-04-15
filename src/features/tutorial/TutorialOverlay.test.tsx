import { renderWithProviders, resetStores, screen, waitFor } from '../../test/testUtils';
import { useSettingsStore } from '../../stores/settingsStore';
import { TutorialOverlay } from './TutorialOverlay';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('TutorialOverlay', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('marks the tutorial complete and navigates when the first mission is chosen', async () => {
    const { user } = renderWithProviders(<TutorialOverlay />);

    expect(screen.getByText('첫 세션 미션')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '오늘 일정 보기' }));

    expect(useSettingsStore.getState().tutorialComplete).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('/manager/day');
  });

  it('lets the player skip the tutorial immediately', async () => {
    const { user } = renderWithProviders(<TutorialOverlay />);

    await user.click(screen.getByRole('button', { name: '나중에 볼게요' }));

    await waitFor(() => {
      expect(useSettingsStore.getState().tutorialComplete).toBe(true);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
