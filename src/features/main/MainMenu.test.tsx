import { renderWithProviders, screen, waitFor, resetStores } from '../../test/testUtils';
import { MainMenu } from './MainMenu';

const { mockNavigate, mockCheckOllamaStatus, mockGetSaveSlots, mockLoadSave, mockLoadGameIntoStore, mockExitApp } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCheckOllamaStatus: vi.fn(),
  mockGetSaveSlots: vi.fn(),
  mockLoadSave: vi.fn(),
  mockLoadGameIntoStore: vi.fn(),
  mockExitApp: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
vi.mock('../../ai/provider', () => ({ checkOllamaStatus: mockCheckOllamaStatus }));
vi.mock('../../engine/save/saveEngine', () => ({ getSaveSlots: mockGetSaveSlots, loadSave: mockLoadSave }));
vi.mock('../../db/initGame', () => ({ loadGameIntoStore: mockLoadGameIntoStore }));
vi.mock('../../hooks/useBgm', () => ({ useBgm: vi.fn() }));
vi.mock('../../utils/windowManager', () => ({ exitApp: mockExitApp }));

describe('MainMenu', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    vi.stubGlobal('__APP_VERSION__', 'test-version');
    mockCheckOllamaStatus.mockResolvedValue(false);
  });

  it('shows continue card when a recent save exists', async () => {
    mockGetSaveSlots.mockResolvedValue([
      { slotNumber: 1, save: { id: 10, mode: 'manager', userTeamId: 'lck_T1', currentSeasonId: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z', slotNumber: 1, saveName: 'T1 Spring', playTimeMinutes: 120, teamName: 'T1', seasonInfo: '2026 Spring W3' } },
    ]);

    renderWithProviders(<MainMenu />);

    expect(await screen.findByText('T1 커리어 진행 중')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '계속 진행' })).toBeInTheDocument();
  });

  it('shows new career CTA when there is no save', async () => {
    mockGetSaveSlots.mockResolvedValue([]);
    renderWithProviders(<MainMenu />);
    await waitFor(() => expect(screen.getByRole('button', { name: '새 커리어 시작' })).toBeInTheDocument());
    expect(screen.getByText('첫 커리어를 시작할 준비가 됐습니다')).toBeInTheDocument();
  });
});
