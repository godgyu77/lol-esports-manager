import { invoke } from '@tauri-apps/api/core';

interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiProviderOptions {
  model?: string;
  format?: 'json';
  systemPrompt?: string;
}

const DEFAULT_MODEL = 'qwen3:30b-a3b';

/**
 * Ollama 상태 확인
 */
export async function checkOllamaStatus(): Promise<boolean> {
  try {
    return await invoke<boolean>('check_ollama_status');
  } catch {
    return false;
  }
}

/**
 * LLM 대화 요청
 */
export async function chatWithLlm(
  userMessage: string,
  options: AiProviderOptions = {},
): Promise<string> {
  const { model = DEFAULT_MODEL, format, systemPrompt } = options;

  const messages: LlmMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    return await invoke<string>('chat_with_llm', {
      model,
      messages,
      format: format ?? null,
    });
  } catch (error) {
    console.warn('LLM 호출 실패, 폴백 사용:', error);
    throw error;
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

  return JSON.parse(response) as T;
}
