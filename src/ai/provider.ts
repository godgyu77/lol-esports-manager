import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore, type AiProvider } from '../stores/settingsStore';
import { type ZodSchema } from 'zod';

interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiProviderOptions {
  model?: string;
  format?: 'json';
  systemPrompt?: string;
}

const DEFAULT_FALLBACK_MODEL = 'qwen3:0.6b';

const getModel = (): string =>
  useSettingsStore.getState().aiModel || DEFAULT_FALLBACK_MODEL;

// ─────────────────────────────────────────
// Ollama (로컬 LLM) — Rust invoke
// ─────────────────────────────────────────

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

// ─────────────────────────────────────────
// OpenAI API — Rust invoke (API 키 비노출)
// ─────────────────────────────────────────

async function chatWithOpenAI(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('OpenAI API key not set');

  const endpoint = settings.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
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

// ─────────────────────────────────────────
// Claude (Anthropic) API — Rust invoke (API 키 비노출)
// ─────────────────────────────────────────

async function chatWithClaude(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('Claude API key not set');

  const endpoint = settings.apiEndpoint || 'https://api.anthropic.com/v1/messages';
  const model = settings.apiModel || 'claude-haiku-4-5-20251001';

  const messages: LlmMessage[] = [];
  messages.push({ role: 'user', content: userMessage });

  return invoke<string>('chat_with_claude', {
    apiKey,
    endpoint,
    model,
    messages,
    systemPrompt: options.systemPrompt ?? null,
    maxTokens: 1024,
  });
}

// ─────────────────────────────────────────
// Google Gemini API — Rust invoke (API 키 비노출)
// ─────────────────────────────────────────

async function chatWithGemini(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('Gemini API key not set');

  const model = settings.apiModel || 'gemini-2.0-flash';

  const messages: LlmMessage[] = [];
  messages.push({ role: 'user', content: userMessage });

  return invoke<string>('chat_with_gemini', {
    apiKey,
    model,
    messages,
    systemPrompt: options.systemPrompt ?? null,
    formatJson: options.format === 'json',
  });
}

// ─────────────────────────────────────────
// Grok (xAI) API — Rust invoke (OpenAI 호환)
// ─────────────────────────────────────────

async function chatWithGrok(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = await settings.getApiKey();
  if (!apiKey) throw new Error('Grok API key not set');

  const endpoint = settings.apiEndpoint || 'https://api.x.ai/v1/chat/completions';
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

// ─────────────────────────────────────────
// 프로바이더 폴백 체인
// ─────────────────────────────────────────

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const PROVIDER_CHAIN: AiProvider[] = IS_MOBILE
  ? ['openai', 'claude', 'gemini', 'grok']
  : ['ollama', 'openai', 'claude', 'gemini', 'grok'];

type ProviderFn = (msg: string, opts: AiProviderOptions) => Promise<string>;

const PROVIDER_FN_MAP: Record<string, ProviderFn> = {
  ollama: chatWithOllama,
  openai: chatWithOpenAI,
  claude: chatWithClaude,
  gemini: chatWithGemini,
  grok: chatWithGrok,
};

async function isProviderAvailable(provider: AiProvider): Promise<boolean> {
  if (provider === 'template') return false;
  if (provider === 'ollama') {
    try {
      return await invoke<boolean>('check_ollama_status');
    } catch {
      return false;
    }
  }
  // openai / claude / gemini / grok — API key 필요
  const key = await useSettingsStore.getState().getApiKey();
  return !!key;
}

/**
 * Ollama 상태 확인 (프로바이더에 따라 분기)
 */
export async function checkOllamaStatus(): Promise<boolean> {
  const provider = useSettingsStore.getState().aiProvider;

  if (provider === 'template') return false;

  if (provider === 'openai' || provider === 'claude' || provider === 'gemini' || provider === 'grok') {
    const key = await useSettingsStore.getState().getApiKey();
    return !!key;
  }

  // Ollama 로컬 확인
  try {
    return await invoke<boolean>('check_ollama_status');
  } catch {
    return false;
  }
}

/**
 * LLM 대화 요청 - 설정된 프로바이더부터 시작, 실패 시 자동 폴백
 * 체인: configured → 나머지 (ollama/openai/claude)
 * 모든 프로바이더 실패 시 throw → 호출부의 template fallback 동작
 */
export async function chatWithLlm(
  userMessage: string,
  options: AiProviderOptions = {},
): Promise<string> {
  const configured = useSettingsStore.getState().aiProvider;

  if (configured === 'template') {
    throw new Error('Template mode - no LLM available');
  }

  // configured부터 시작하는 순환 체인 구성
  const startIdx = PROVIDER_CHAIN.indexOf(configured);
  const chain =
    startIdx >= 0
      ? [...PROVIDER_CHAIN.slice(startIdx), ...PROVIDER_CHAIN.slice(0, startIdx)]
      : PROVIDER_CHAIN;

  const errors: string[] = [];

  for (const provider of chain) {
    const fn = PROVIDER_FN_MAP[provider];
    if (!fn) continue;

    const available = await isProviderAvailable(provider);
    if (!available) {
      console.warn(`[AI Fallback] ${provider} 사용 불가 (설정 미완료), 건너뜀`);
      continue;
    }

    try {
      const result = await fn(userMessage, options);
      if (provider !== configured) {
        console.info(`[AI Fallback] ${configured} 실패 → ${provider}로 대체 성공`);
      }
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`[AI Fallback] ${provider} 호출 실패: ${msg}`);
      errors.push(`${provider}: ${msg}`);
    }
  }

  throw new Error(`모든 AI 프로바이더 실패: ${errors.join(' | ')}`);
}

// ─────────────────────────────────────────
// 구조화된 JSON 응답 (Zod 검증 지원)
// ─────────────────────────────────────────

interface ChatJsonOptions<T> extends Omit<AiProviderOptions, 'format'> {
  schema?: ZodSchema<T>;
}

/**
 * 구조화된 JSON 응답 요청
 * schema 전달 시 safeParse 검증 → 실패 시 1회 재시도 → 재실패 시 throw
 */
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
      throw new Error(`AI 응답 JSON 파싱 실패: ${cleaned.slice(0, 100)}`);
    }

    if (!schema) return parsed as T;

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;

    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    throw new Error(`AI 응답 스키마 검증 실패: ${issues}`);
  };

  try {
    return await tryOnce();
  } catch (error) {
    if (schema) {
      console.warn('AI 응답 검증 실패, 1회 재시도:', error);
      return await tryOnce();
    }
    throw error;
  }
}

/**
 * 클라우드 API 연결 테스트
 */
export async function testCloudConnection(): Promise<{ ok: boolean; message: string }> {
  const provider = useSettingsStore.getState().aiProvider;

  if (provider === 'template') {
    return { ok: false, message: '템플릿 모드에서는 연결 테스트가 필요하지 않습니다.' };
  }

  if (provider === 'ollama') {
    try {
      const status = await invoke<boolean>('check_ollama_status');
      return status
        ? { ok: true, message: 'Ollama 연결 성공' }
        : { ok: false, message: 'Ollama가 실행되고 있지 않습니다.' };
    } catch {
      return { ok: false, message: 'Ollama 연결 실패' };
    }
  }

  // Cloud API test: send a minimal request
  try {
    const response = await chatWithLlm('Reply with exactly: OK', {
      systemPrompt: 'You are a connection test. Reply with exactly one word: OK',
    });
    return { ok: true, message: `연결 성공 (응답: ${response.slice(0, 20)})` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `연결 실패: ${msg}` };
  }
}
