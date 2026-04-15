import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileAiSetup } from './MobileAiSetup';

const {
  mockSetAiEnabled,
  mockSetAiModel,
  mockSetAiProvider,
  mockSetAiSetupCompleted,
  mockSetAiSetupSkipped,
  mockSetApiKey,
} = vi.hoisted(() => ({
  mockSetAiEnabled: vi.fn(),
  mockSetAiModel: vi.fn(),
  mockSetAiProvider: vi.fn(),
  mockSetAiSetupCompleted: vi.fn(),
  mockSetAiSetupSkipped: vi.fn(),
  mockSetApiKey: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      setAiEnabled: mockSetAiEnabled,
      setAiModel: mockSetAiModel,
      setAiProvider: mockSetAiProvider,
      setAiSetupCompleted: mockSetAiSetupCompleted,
      setAiSetupSkipped: mockSetAiSetupSkipped,
      setApiKey: mockSetApiKey,
    }),
}));

describe('MobileAiSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetApiKey.mockResolvedValue(undefined);
  });

  it('starts with template mode and lets the user continue without an API key', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();

    render(<MobileAiSetup onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: '계속 진행' }));

    expect(mockSetAiProvider).toHaveBeenCalledWith('template');
    expect(mockSetAiModel).toHaveBeenCalledWith('');
    expect(mockSetAiEnabled).toHaveBeenCalledWith(false);
    expect(mockSetAiSetupCompleted).toHaveBeenCalledWith(false);
    expect(mockSetAiSetupSkipped).toHaveBeenCalledWith(true);
    expect(mockSetApiKey).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('stores the selected cloud provider API key before completing', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();

    render(<MobileAiSetup onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: /OpenAI/ }));
    await user.type(screen.getByPlaceholderText('OpenAI API key'), 'test-api-key');
    await user.click(screen.getByRole('button', { name: '계속 진행' }));

    expect(mockSetAiProvider).toHaveBeenCalledWith('openai');
    expect(mockSetAiModel).toHaveBeenCalledWith('gpt-4o-mini');
    expect(mockSetApiKey).toHaveBeenCalledWith('test-api-key', 'openai');
    expect(mockSetAiEnabled).toHaveBeenCalledWith(true);
    expect(mockSetAiSetupCompleted).toHaveBeenCalledWith(true);
    expect(mockSetAiSetupSkipped).toHaveBeenCalledWith(false);
    expect(onComplete).toHaveBeenCalled();
  });
});
