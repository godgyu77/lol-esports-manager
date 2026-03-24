/**
 * RAG (Retrieval Augmented Generation) 엔진
 * - SQLite FTS5 기반 전문 검색
 * - FTS 불가 시 키워드 매칭 폴백
 * - LLM 프롬프트에 관련 지식을 자동 주입
 */

import { getDatabase } from '../../db/database';
import { LOL_KNOWLEDGE_BASE, type KnowledgeEntry } from './knowledgeBase';

// ─────────────────────────────────────────
// FTS5 테이블 초기화
// ─────────────────────────────────────────

/**
 * FTS5 테이블 초기화 -- 앱 시작 시 1회 호출
 */
export async function initializeKnowledgeBase(): Promise<void> {
  const db = await getDatabase();

  // FTS5 가상 테이블 생성 (이미 있으면 무시)
  await db.execute(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      entry_id, category, title, content, keywords,
      tokenize='unicode61'
    )
  `);

  // 데이터 없으면 초기 로딩
  const count = await db.select<{ cnt: number }[]>(
    'SELECT COUNT(*) as cnt FROM knowledge_fts',
  );

  if ((count[0]?.cnt ?? 0) === 0) {
    for (const entry of LOL_KNOWLEDGE_BASE) {
      await db.execute(
        'INSERT INTO knowledge_fts (entry_id, category, title, content, keywords) VALUES ($1, $2, $3, $4, $5)',
        [
          entry.id,
          entry.category,
          entry.title,
          entry.content,
          entry.keywords.join(' '),
        ],
      );
    }
  }
}

// ─────────────────────────────────────────
// 검색
// ─────────────────────────────────────────

/**
 * FTS5 쿼리 문자열 생성 -- 특수문자 이스케이프 및 OR 연결
 */
function buildFtsQuery(query: string): string {
  const words = query
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return '';

  // 각 단어를 쌍따옴표로 감싸고 OR 로 연결
  return words.map((w) => `"${w}"`).join(' OR ');
}

/**
 * 쿼리와 관련된 지식 검색
 * @param query 검색어 (예: "아지르 밴", "초반 어그로 전략")
 * @param limit 결과 수
 * @returns 관련 지식 항목
 */
export async function searchKnowledge(
  query: string,
  limit = 3,
): Promise<KnowledgeEntry[]> {
  const ftsQuery = buildFtsQuery(query);

  if (!ftsQuery) return [];

  const db = await getDatabase();

  try {
    // FTS5 MATCH 검색
    const rows = await db.select<
      {
        entry_id: string;
        category: KnowledgeEntry['category'];
        title: string;
        content: string;
        keywords: string;
        relevance: number;
      }[]
    >(
      `SELECT entry_id, category, title, content, keywords,
              rank as relevance
       FROM knowledge_fts
       WHERE knowledge_fts MATCH $1
       ORDER BY rank
       LIMIT $2`,
      [ftsQuery, limit],
    );

    return rows.map((r) => ({
      id: r.entry_id,
      category: r.category,
      title: r.title,
      content: r.content,
      keywords: (r.keywords ?? '').split(' '),
    }));
  } catch {
    // FTS 검색 실패 시 키워드 기반 폴백
    return keywordFallbackSearch(query, limit);
  }
}

// ─────────────────────────────────────────
// 키워드 폴백 검색
// ─────────────────────────────────────────

/**
 * FTS 불가 시 키워드 매칭 폴백
 */
export function keywordFallbackSearch(
  query: string,
  limit: number,
): KnowledgeEntry[] {
  const queryWords = query.toLowerCase().split(/\s+/);

  const scored = LOL_KNOWLEDGE_BASE.map((entry) => {
    const entryText =
      `${entry.title} ${entry.content} ${entry.keywords.join(' ')}`.toLowerCase();
    const score = queryWords.filter((w) => entryText.includes(w)).length;
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

// ─────────────────────────────────────────
// 프롬프트 보강
// ─────────────────────────────────────────

/**
 * RAG 프롬프트 보강 -- 쿼리 관련 지식을 프롬프트에 주입
 */
export async function augmentPromptWithKnowledge(
  basePrompt: string,
  query: string,
  maxEntries = 3,
): Promise<string> {
  const entries = await searchKnowledge(query, maxEntries);

  if (entries.length === 0) return basePrompt;

  const knowledgeBlock = entries
    .map((e) => `[${e.title}] ${e.content}`)
    .join('\n');

  return `${basePrompt}\n\n[참고 지식]\n${knowledgeBlock}`;
}
