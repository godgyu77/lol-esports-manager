import { invoke } from '@tauri-apps/api/core';
import { type ZodSchema } from 'zod';
import { useSettingsStore, type AiProvider } from '../stores/settingsStore';

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

const DEFAULT_FALLBACK_MODEL = 'qwen3:0.6b';
const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_GROK_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

const getModel = (): string =>
  useSettingsStore.getState().aiModel || DEFAULT_FALLBACK_MODEL;

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

async function getOllamaStatusDetail(
  waitForReady = false,
): Promise<OllamaStatusDetail> {
  if (waitForReady) {
    return invoke<OllamaStatusDetail>('ensure_ollama_ready');
  }
  return invoke<OllamaStatusDetail>('get_ollama_status_detail');
}

async function chatWithOllama(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const { model = getModel(), format, systemPrompt } = options;

  const messages: LlmMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  return invoke<string>('chat_with_llm', {
    model,
    messages,
    format: format ?? null,
  });
}

async function chatWithOpenAI(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('OpenAI 설정이 완료되지 않았습니다. API 키를 확인해 주세요.');

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

async function chatWithClaude(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('Claude 설정이 완료되지 않았습니다. API 키를 확인해 주세요.');

  const endpoint = settings.apiEndpoint || DEFAULT_CLAUDE_ENDPOINT;
  const model = settings.apiModel || 'claude-haiku-4-5-20251001';
  const messages: LlmMessage[] = [{ role: 'user', content: userMessage }];

  return invoke<string>('chat_with_claude', {
    apiKey,
    endpoint,
    model,
    messages,
    systemPrompt: options.systemPrompt ?? null,
    maxTokens: 1024,
  });
}

async function chatWithGemini(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('Gemini 설정이 완료되지 않았습니다. API 키를 확인해 주세요.');

  const model = settings.apiModel || 'gemini-2.0-flash';
  const messages: LlmMessage[] = [{ role: 'user', content: userMessage }];

  return invoke<string>('chat_with_gemini', {
    apiKey,
    model,
    messages,
    systemPrompt: options.systemPrompt ?? null,
    formatJson: options.format === 'json',
  });
}

async function chatWithGrok(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('Grok 설정이 완료되지 않았습니다. API 키를 확인해 주세요.');

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
  return '템플릿 모드에서는 실시간 LLM 호출을 직접 수행하지 않습니다.';
}

async function hasConfiguredCloudApiKey(): Promise<boolean> {
  const key = await useSettingsStore.getState().getApiKey();
  return !!key;
}

async function tryCloudFallback(
  configuredProvider: AiProvider,
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  if (!(await hasConfiguredCloudApiKey())) {
    throw new Error('클라우드 AI 설정이 완료되지 않았습니다. API 키를 확인해 주세요.');
  }

  const cloudProviders =
    configuredProvider !== 'template' && configuredProvider !== 'ollama'
      ? [configuredProvider, ...CLOUD_PROVIDER_CHAIN.filter((provider) => provider !== configuredProvider)]
      : CLOUD_PROVIDER_CHAIN;

  const errors: string[] = [];
  for (const provider of cloudProviders) {
    try {
      const handler = PROVIDER_FN_MAP[provider as Exclude<AiProvider, 'template'>];
      return await handler(userMessage, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnOnce(`cloud-${provider}`, `[AI 폴백] ${provider} 호출 실패: ${message}`);
      errors.push(`${provider}: ${message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

export async function checkOllamaStatus(): Promise<boolean> {
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

  if (configured === 'ollama') {
    try {
      const detail = await getOllamaStatusDetail(true);
      if (detail.ready) {
        return await chatWithOllama(userMessage, options);
      }
      warnOnce('ollama-not-ready', `[AI 폴백] Ollama 준비 대기 실패: ${detail.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnOnce('ollama-failed', `[AI 폴백] ollama 호출 실패: ${message}`);
    }

    return tryCloudFallback(configured, userMessage, options);
  }

  try {
    return await PROVIDER_FN_MAP[configured](userMessage, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    warnOnce(`configured-${configured}`, `[AI 폴백] ${configured} 호출 실패: ${message}`);
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
      throw new Error(`AI 응답의 JSON 파싱에 실패했습니다: ${cleaned.slice(0, 100)}`);
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
      console.warn('AI 응답 검증에 실패해 한 번 더 재시도합니다.', error);
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

  if (provider === 'ollama') {
    try {
      const detail = await getOllamaStatusDetail(true);
      return detail.ready
        ? { ok: true, message: 'Ollama 서버 연결에 성공했습니다.' }
        : { ok: false, message: detail.message };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Ollama 연결에 실패했습니다: ${message}` };
    }
  }

  try {
    const response = await chatWithLlm('정확히 OK 한 단어만 답하세요.', {
      systemPrompt: '당신은 연결 테스트용 AI입니다. 반드시 OK 한 단어만 답하세요.',
    });
    return { ok: true, message: `연결에 성공했습니다. 응답: ${response.slice(0, 20)}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `연결에 실패했습니다: ${message}` };
  }
}
