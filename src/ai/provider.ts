import { invoke } from '@tauri-apps/api/core';
import { type ZodSchema } from 'zod';
import { useSettingsStore, type AiProvider, isMobileRuntime } from '../stores/settingsStore';

interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiProviderOptions {
  model?: string;
  format?: 'json';
  systemPrompt?: string;
}

interface OllamaStatusDetail {
  status: 'not_started' | 'starting' | 'ready' | 'failed';
  ready: boolean;
  message: string;
}

const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const OLLAMA_MODEL_PREFERENCE = ['qwen3:1.7b', 'qwen3:4b', 'qwen3:8b', 'llama3.2:3b', 'llama3.2:1b'];

const providerWarnings = new Set<string>();

function warnOnce(key: string, message: string, error?: unknown): void {
  if (providerWarnings.has(key)) return;
  providerWarnings.add(key);
  if (error) {
    console.warn(message, error);
  } else {
    console.warn(message);
  }
}

async function getOllamaStatusDetail(waitForReady = false): Promise<OllamaStatusDetail> {
  if (waitForReady) {
    return invoke<OllamaStatusDetail>('ensure_ollama_ready');
  }
  return invoke<OllamaStatusDetail>('get_ollama_status_detail');
}

async function listInstalledOllamaModels(): Promise<string[]> {
  try {
    const models = await invoke<string[]>('list_models');
    return models.filter(Boolean);
  } catch {
    return [];
  }
}

function choosePreferredOllamaModel(models: string[]): string {
  const preferred = OLLAMA_MODEL_PREFERENCE.find((candidate) => models.includes(candidate));
  return preferred ?? models[0] ?? '';
}

async function resolveOllamaModel(requestedModel?: string): Promise<string> {
  if (requestedModel) return requestedModel;

  const storedModel = useSettingsStore.getState().aiModel;
  const installedModels = await listInstalledOllamaModels();

  if (storedModel && installedModels.includes(storedModel)) {
    return storedModel;
  }

  const fallbackModel = choosePreferredOllamaModel(installedModels);
  if (fallbackModel) {
    useSettingsStore.getState().setAiModel(fallbackModel);
    return fallbackModel;
  }

  throw new Error('설치된 Ollama 모델이 없습니다. AI 설정에서 모델을 먼저 다운로드해주세요.');
}

async function chatWithOllama(userMessage: string, options: AiProviderOptions): Promise<string> {
  const model = await resolveOllamaModel(options.model);

  const messages: LlmMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    return await invoke<string>('chat_with_llm', {
      model,
      messages,
      format: options.format ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found')) {
      throw new Error(`Ollama 모델 "${model}"을 찾을 수 없습니다. AI 설정에서 로컬 모델을 다시 선택해주세요.`);
    }
    throw error;
  }
}

async function _requireApiKey(providerLabel: string): Promise<string> {
  const provider = useSettingsStore.getState().aiProvider;
  const apiKey = await useSettingsStore.getState().getApiKey(provider);
  if (!apiKey) {
    throw new Error(`${providerLabel} API 키가 설정되지 않았습니다. 설정 화면에서 API 키를 입력해주세요.`);
  }
  return apiKey;
}

async function requireProviderApiKey(provider: Exclude<AiProvider, 'ollama' | 'template'>, providerLabel: string): Promise<string> {
  const apiKey = await useSettingsStore.getState().getApiKey(provider);
  if (!apiKey) {
    throw new Error(`${providerLabel} API 키가 설정되지 않았습니다. 설정 화면에서 API 키를 입력해주세요.`);
  }
  return apiKey;
}

async function chatWithOpenAI(userMessage: string, options: AiProviderOptions): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await requireProviderApiKey('openai', 'OpenAI');
  const endpoint = settings.apiEndpoint || DEFAULT_OPENAI_ENDPOINT;
  const model = settings.apiModel || 'gpt-4o-mini';

  const messages: LlmMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  return invoke<string>('chat_with_openai', {
    apiKey,
    endpoint,
    model,
    messages,
    formatJson: options.format === 'json',
  });
}

async function chatWithClaude(userMessage: string, options: AiProviderOptions): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await requireProviderApiKey('claude', 'Claude');
  const endpoint = settings.apiEndpoint || DEFAULT_CLAUDE_ENDPOINT;
  const model = settings.apiModel || 'claude-haiku-4-5-20251001';

  return invoke<string>('chat_with_claude', {
    apiKey,
    endpoint,
    model,
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt: options.systemPrompt ?? null,
    maxTokens: 1024,
  });
}

async function chatWithGemini(userMessage: string, options: AiProviderOptions): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await requireProviderApiKey('gemini', 'Gemini');
  const model = settings.apiModel || 'gemini-2.0-flash';

  return invoke<string>('chat_with_gemini', {
    apiKey,
    model,
    messages: [{ role: 'user', content: userMessage }],
    systemPrompt: options.systemPrompt ?? null,
    formatJson: options.format === 'json',
  });
}

async function chatWithGrok(userMessage: string, options: AiProviderOptions): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await requireProviderApiKey('grok', 'Grok');
  const endpoint = settings.apiEndpoint || DEFAULT_GROK_ENDPOINT;
  const model = settings.apiModel || 'grok-3-mini';

  const messages: LlmMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  return invoke<string>('chat_with_grok', {
    apiKey,
    endpoint,
    model,
    messages,
    formatJson: options.format === 'json',
  });
}

const CLOUD_PROVIDER_CHAIN: AiProvider[] = ['openai', 'claude', 'gemini', 'grok'];
type ProviderFn = (message: string, options: AiProviderOptions) => Promise<string>;

const PROVIDER_FN_MAP: Record<Exclude<AiProvider, 'template'>, ProviderFn> = {
  ollama: chatWithOllama,
  openai: chatWithOpenAI,
  claude: chatWithClaude,
  gemini: chatWithGemini,
  grok: chatWithGrok,
};

function getTemplateModeMessage(): string {
  return '템플릿 모드에서는 실시간 AI 호출을 사용하지 않습니다.';
}

async function hasConfiguredCloudApiKey(provider: Exclude<AiProvider, 'ollama' | 'template'>): Promise<boolean> {
  const key = await useSettingsStore.getState().getApiKey(provider);
  return !!key;
}

async function tryCloudFallback(
  configuredProvider: AiProvider,
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const cloudProviders =
    configuredProvider !== 'template' && configuredProvider !== 'ollama'
      ? [configuredProvider, ...CLOUD_PROVIDER_CHAIN.filter((provider) => provider !== configuredProvider)]
      : CLOUD_PROVIDER_CHAIN;

  const errors: string[] = [];
  for (const provider of cloudProviders) {
    if (!(await hasConfiguredCloudApiKey(provider))) {
      errors.push(`${provider}: missing_api_key`);
      continue;
    }
    try {
      const handler = PROVIDER_FN_MAP[provider as Exclude<AiProvider, 'template'>];
      return await handler(userMessage, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnOnce(`cloud-${provider}`, `[AI fallback] ${provider} 호출 실패: ${message}`);
      errors.push(`${provider}: ${message}`);
    }
  }

  if (errors.every((message) => message.endsWith('missing_api_key'))) {
    throw new Error('클라우드 AI 폴백을 사용할 수 없습니다. 사용하려는 provider의 API 키를 먼저 설정해주세요.');
  }

  throw new Error(errors.join(' | '));
}

export async function checkOllamaStatus(): Promise<boolean> {
  if (isMobileRuntime()) return false;
  try {
    const detail = await getOllamaStatusDetail(false);
    return detail.ready;
  } catch {
    return false;
  }
}

export async function chatWithLlm(
  userMessage: string,
  options: AiProviderOptions = {},
): Promise<string> {
  const configured = useSettingsStore.getState().aiProvider;

  if (configured === 'template') {
    throw new Error(getTemplateModeMessage());
  }

  if (isMobileRuntime() && configured === 'ollama') {
    return tryCloudFallback('template', userMessage, options);
  }

  if (configured === 'ollama') {
    try {
      const detail = await getOllamaStatusDetail(true);
      if (detail.ready) {
        return await chatWithOllama(userMessage, options);
      }
      warnOnce('ollama-not-ready', `[AI fallback] Ollama 준비 실패: ${detail.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnOnce('ollama-failed', `[AI fallback] Ollama 호출 실패: ${message}`);
    }

    return tryCloudFallback(configured, userMessage, options);
  }

  try {
    return await PROVIDER_FN_MAP[configured](userMessage, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnOnce(`configured-${configured}`, `[AI fallback] ${configured} 호출 실패: ${message}`);
    return tryCloudFallback(configured, userMessage, options);
  }
}

interface ChatJsonOptions<T> extends Omit<AiProviderOptions, 'format'> {
  schema?: ZodSchema<T>;
}

export async function chatWithLlmJson<T>(
  userMessage: string,
  options: ChatJsonOptions<T> = {},
): Promise<T> {
  const { schema, ...llmOptions } = options;

  const tryOnce = async (): Promise<T> => {
    const response = await chatWithLlm(userMessage, {
      ...llmOptions,
      format: 'json',
    });

    const cleaned = response
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`AI 응답을 JSON으로 해석하지 못했습니다: ${cleaned.slice(0, 100)}`);
    }

    if (!schema) return parsed as T;

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;

    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`AI 응답이 스키마 검증을 통과하지 못했습니다: ${issues}`);
  };

  try {
    return await tryOnce();
  } catch (error) {
    if (schema) {
      console.warn('AI 응답 검증에 실패해서 한 번 더 재시도합니다.', error);
      return await tryOnce();
    }
    throw error;
  }
}

export async function testCloudConnection(): Promise<{ ok: boolean; message: string }> {
  const provider = useSettingsStore.getState().aiProvider;

  if (provider === 'template') {
    return {
      ok: false,
      message: '템플릿 모드에서는 연결 테스트가 필요하지 않습니다.',
    };
  }

  if (isMobileRuntime() && provider === 'ollama') {
    return {
      ok: false,
      message: '모바일에서는 로컬 Ollama를 사용할 수 없습니다. 클라우드 AI 또는 템플릿 모드를 선택해 주세요.',
    };
  }

  if (provider === 'ollama') {
    try {
      const detail = await getOllamaStatusDetail(true);
      if (!detail.ready) {
        return { ok: false, message: detail.message };
      }

      const model = await resolveOllamaModel();
      return { ok: true, message: `Ollama 연결에 성공했습니다. 사용 모델: ${model}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Ollama 연결 테스트에 실패했습니다: ${message}` };
    }
  }

  try {
    const handler = PROVIDER_FN_MAP[provider];
    const providerLabel = provider.toUpperCase();

    await requireProviderApiKey(provider, providerLabel);

    const response = await handler('정확히 OK 한 단어로만 답해주세요.', {
      systemPrompt: '당신은 연결 테스트용 AI입니다. 반드시 OK 한 단어로만 답해주세요.',
    });

    return {
      ok: true,
      message: `${providerLabel} 연결에 성공했습니다. 응답: ${response.slice(0, 20)}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `연결 테스트에 실패했습니다: ${message}` };
  }
}
