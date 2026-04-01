import { invoke } from '@tauri-apps/api/core';
import { chatWithLlm, testCloudConnection } from './provider';
import { useSettingsStore } from '../stores/settingsStore';

const mockInvoke = vi.mocked(invoke);

describe('provider', () => {
  const originalState = useSettingsStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      aiEnabled: true,
      aiProvider: 'openai',
      aiModel: 'qwen3:4b',
      apiEndpoint: '',
      apiModel: 'gpt-4o-mini',
      getApiKey: originalState.getApiKey,
    });
  });

  afterAll(() => {
    useSettingsStore.setState({
      aiEnabled: originalState.aiEnabled,
      aiProvider: originalState.aiProvider,
      aiModel: originalState.aiModel,
      apiEndpoint: originalState.apiEndpoint,
      apiModel: originalState.apiModel,
      getApiKey: originalState.getApiKey,
    });
  });

  it('선택한 provider의 키로만 연결 테스트를 수행한다', async () => {
    useSettingsStore.setState({
      aiProvider: 'openai',
      getApiKey: vi.fn(async (provider) => (provider === 'openai' ? 'openai-key' : '')),
    });
    mockInvoke.mockResolvedValueOnce('OK');

    const result = await testCloudConnection();

    expect(result.ok).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      'chat_with_openai',
      expect.objectContaining({
        apiKey: 'openai-key',
        model: 'gpt-4o-mini',
      }),
    );
  });

  it('선택한 provider의 키가 없으면 즉시 실패한다', async () => {
    useSettingsStore.setState({
      aiProvider: 'openai',
      getApiKey: vi.fn(async () => ''),
    });

    const result = await testCloudConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('API 키');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('템플릿 모드에서는 연결 테스트를 비활성 메시지로 처리한다', async () => {
    useSettingsStore.setState({ aiProvider: 'template' });

    const result = await testCloudConnection();

    expect(result.ok).toBe(false);
    expect(result.message).toContain('필요하지 않습니다');
  });

  it('Ollama 실패 시 클라우드 폴백으로 넘어간다', async () => {
    useSettingsStore.setState({
      aiProvider: 'ollama',
      getApiKey: vi.fn(async (provider) => (provider === 'openai' ? 'openai-key' : '')),
    });

    mockInvoke.mockImplementation(async (command, payload) => {
      if (command === 'ensure_ollama_ready') {
        throw new Error('ollama down');
      }

      if (command === 'chat_with_openai') {
        expect(payload).toEqual(expect.objectContaining({ apiKey: 'openai-key' }));
        return 'fallback-ok';
      }

      throw new Error(`unexpected command: ${String(command)}`);
    });

    const result = await chatWithLlm('테스트 메시지');

    expect(result).toBe('fallback-ok');
  });

  it('모든 클라우드 키가 없으면 명시적으로 실패한다', async () => {
    useSettingsStore.setState({
      aiProvider: 'ollama',
      getApiKey: vi.fn(async () => ''),
    });

    mockInvoke.mockImplementation(async (command) => {
      if (command === 'ensure_ollama_ready') {
        throw new Error('ollama down');
      }

      throw new Error(`unexpected command: ${String(command)}`);
    });

    await expect(chatWithLlm('테스트 메시지')).rejects.toThrow('클라우드 AI 폴백을 사용할 수 없습니다');
  });
});
