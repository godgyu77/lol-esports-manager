import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';

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
// Ollama (로컬 LLM)
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
// OpenAI API
// ─────────────────────────────────────────

async function chatWithOpenAI(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = settings.getApiKey();
  if (!apiKey) throw new Error('OpenAI API key not set');

  const endpoint = settings.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
  const model = settings.apiModel || 'gpt-4o-mini';

  const messages: { role: string; content: string }[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.7,
  };

  if (options.format === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI API returned empty or invalid response');
  return content;
}

// ─────────────────────────────────────────
// Claude (Anthropic) API
// ─────────────────────────────────────────

async function chatWithClaude(
  userMessage: string,
  options: AiProviderOptions,
): Promise<string> {
  const settings = useSettingsStore.getState();
  const apiKey = settings.getApiKey();
  if (!apiKey) throw new Error('Claude API key not set');

  const endpoint = settings.apiEndpoint || 'https://api.anthropic.com/v1/messages';
  const model = settings.apiModel || 'claude-haiku-4-5-20251001';

  const body: Record<string, unknown> = {
    model,
    max_tokens: 1024,
    messages: [{ role: 'user', content: userMessage }],
  };

  if (options.systemPrompt) {
    body.system = options.systemPrompt;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // TODO: Tauri Rust 커맨드를 통한 프록시로 전환 필요
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Claude API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Claude API returned empty or invalid response');
  return text;
}

// ─────────────────────────────────────────
// 통합 라우터
// ─────────────────────────────────────────

/**
 * Ollama 상태 확인 (프로바이더에 따라 분기)
 */
export async function checkOllamaStatus(): Promise<boolean> {
  const provider = useSettingsStore.getState().aiProvider;

  if (provider === 'template') return false;

  if (provider === 'openai' || provider === 'claude') {
    return !!useSettingsStore.getState().getApiKey();
  }

  // Ollama 로컬 확인
  try {
    return await invoke<boolean>('check_ollama_status');
  } catch {
    return false;
  }
}

/**
 * LLM 대화 요청 - 설정된 프로바이더에 따라 자동 라우팅
 */
export async function chatWithLlm(
  userMessage: string,
  options: AiProviderOptions = {},
): Promise<string> {
  const provider = useSettingsStore.getState().aiProvider;

  switch (provider) {
    case 'ollama':
      try {
        return await chatWithOllama(userMessage, options);
      } catch (error) {
        console.warn('Ollama LLM 호출 실패, 폴백 사용:', error);
        throw error;
      }

    case 'openai':
      try {
        return await chatWithOpenAI(userMessage, options);
      } catch (error) {
        console.warn('OpenAI API 호출 실패:', error);
        throw error;
      }

    case 'claude':
      try {
        return await chatWithClaude(userMessage, options);
      } catch (error) {
        console.warn('Claude API 호출 실패:', error);
        throw error;
      }

    case 'template':
    default:
      throw new Error('Template mode - no LLM available');
  }
}

/**
 * 구조화된 JSON 응답 요청
 */
export async function chatWithLlmJson<T>(
  userMessage: string,
  options: Omit<AiProviderOptions, 'format'> = {},
): Promise<T> {
  const response = await chatWithLlm(userMessage, {
    ...options,
    format: 'json',
  });

  const cleaned = response.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`AI 응답 JSON 파싱 실패: ${cleaned.slice(0, 100)}`);
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
