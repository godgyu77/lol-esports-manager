import { renderWithProviders, screen, waitFor, resetStores } from '../../test/testUtils';
import { SettingsView } from './SettingsView';

const { mockNavigate, mockCheckOllamaStatus, mockTestCloudConnection } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCheckOllamaStatus: vi.fn(),
  mockTestCloudConnection: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../ai/provider', () => ({
  checkOllamaStatus: mockCheckOllamaStatus,
  testCloudConnection: mockTestCloudConnection,
}));

vi.mock('../../components/AiSetupWizard', () => ({
  AiSetupWizard: () => null,
}));

describe('SettingsView', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    vi.stubGlobal('__APP_VERSION__', 'test-version');
    mockCheckOllamaStatus.mockResolvedValue(false);
    mockTestCloudConnection.mockResolvedValue({ ok: true, message: 'ok' });
  });

  it('shows provider key status labels', async () => {
    renderWithProviders(<SettingsView />, {
      settingsState: {
        aiEnabled: true,
        aiProvider: 'openai',
        hasApiKey: true,
        getApiKey: vi.fn(async (provider?: string) => {
          if (provider === 'openai') return 'openai-key';
          if (provider === 'claude') return '';
          if (provider === 'gemini') return 'gemini-key';
          return '';
        }),
      },
    });

    await waitFor(() => {
      expect(screen.getAllByText(/API 키 저장됨/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/API 키 없음/i).length).toBeGreaterThan(0);
    });
  });

  it('shows execution policy and AI feature policy section', async () => {
    renderWithProviders(<SettingsView />, {
      settingsState: {
        aiEnabled: true,
        aiProvider: 'template',
        hasApiKey: false,
        getApiKey: vi.fn(async () => ''),
      },
    });

    expect(await screen.findByText('현재 실행 정책')).toBeInTheDocument();
    expect(screen.getByText('기능별 AI 정책')).toBeInTheDocument();
    expect(screen.getByText('드래프트 조언')).toBeInTheDocument();
    expect(screen.getByText('스카우팅과 면담')).toBeInTheDocument();
  });
});
