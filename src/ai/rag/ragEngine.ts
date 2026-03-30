import { invoke } from '@tauri-apps/api/core';
import { LOL_KNOWLEDGE_BASE, type KnowledgeEntry } from './knowledgeBase';

interface RagStatus {
  ready: boolean;
  fts_enabled: boolean;
  message: string;
}

interface RagSearchResult {
  id: string;
  category: KnowledgeEntry['category'];
  title: string;
  content: string;
  keywords: string[];
}

let ragStatusCache: RagStatus | null = null;
let initializationPromise: Promise<RagStatus> | null = null;
let initializationWarningLogged = false;

function normalizeStatus(status: RagStatus): RagStatus {
  return {
    ready: status.ready,
    fts_enabled: status.fts_enabled,
    message: status.message,
  };
}

async function initializeViaRust(): Promise<RagStatus> {
  const status = await invoke<RagStatus>('initialize_rag', {
    entries: LOL_KNOWLEDGE_BASE,
  });
  const normalized = normalizeStatus(status);
  ragStatusCache = normalized;
  return normalized;
}

async function ensureRagReady(): Promise<RagStatus> {
  if (ragStatusCache?.ready && ragStatusCache.fts_enabled) {
    return ragStatusCache;
  }

  if (!initializationPromise) {
    initializationPromise = initializeViaRust()
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        const failedStatus = {
          ready: false,
          fts_enabled: false,
          message,
        };
        ragStatusCache = failedStatus;
        throw error;
      })
      .finally(() => {
        initializationPromise = null;
      });
  }

  return initializationPromise;
}

export async function initializeKnowledgeBase(): Promise<void> {
  try {
    await ensureRagReady();
  } catch (error) {
    if (!initializationWarningLogged) {
      console.warn('[RAG] FTS 초기화에 실패해 키워드 검색으로 전환합니다.', error);
      initializationWarningLogged = true;
    }
    throw error;
  }
}

export function keywordFallbackSearch(
  query: string,
  limit: number,
): KnowledgeEntry[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = LOL_KNOWLEDGE_BASE.map((entry) => {
    const entryText =
      `${entry.title} ${entry.content} ${entry.keywords.join(' ')}`.toLowerCase();
    const score = queryWords.filter((word) => entryText.includes(word)).length;
    return { entry, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

export async function searchKnowledge(
  query: string,
  limit = 3,
): Promise<KnowledgeEntry[]> {
  try {
    const status = await ensureRagReady();
    if (!status.ready || !status.fts_enabled) {
      return keywordFallbackSearch(query, limit);
    }

    const results = await invoke<RagSearchResult[]>('search_knowledge', {
      query,
      limit,
    });

    return results.map((result) => ({
      id: result.id,
      category: result.category,
      title: result.title,
      content: result.content,
      keywords: result.keywords,
    }));
  } catch (error) {
    if (!initializationWarningLogged) {
      console.warn('[RAG] Rust FTS 검색에 실패해 키워드 검색으로 전환합니다.', error);
      initializationWarningLogged = true;
    }
    return keywordFallbackSearch(query, limit);
  }
}

export async function getRagStatus(): Promise<RagStatus> {
  if (ragStatusCache) {
    return ragStatusCache;
  }

  try {
    const status = await invoke<RagStatus>('get_rag_status');
    ragStatusCache = normalizeStatus(status);
    return ragStatusCache;
  } catch {
    return {
      ready: false,
      fts_enabled: false,
      message: 'RAG 상태를 아직 확인하지 못했습니다.',
    };
  }
}

export async function augmentPromptWithKnowledge(
  basePrompt: string,
  query: string,
  maxEntries = 3,
): Promise<string> {
  const entries = await searchKnowledge(query, maxEntries);

  if (entries.length === 0) return basePrompt;

  const knowledgeBlock = entries
    .map((entry) => `[${entry.title}] ${entry.content}`)
    .join('\n');

  return `${basePrompt}\n\n[참고 지식]\n${knowledgeBlock}`;
}
