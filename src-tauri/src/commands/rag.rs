use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
pub struct RagState {
    pub status: Mutex<RagStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RagStatus {
    pub ready: bool,
    pub fts_enabled: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagKnowledgeEntry {
    pub id: String,
    pub category: String,
    pub title: String,
    pub content: String,
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RagSearchResult {
    pub id: String,
    pub category: String,
    pub title: String,
    pub content: String,
    pub keywords: Vec<String>,
}

fn rag_db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("knowledge.db"))
}

fn update_status(state: &State<'_, RagState>, ready: bool, fts_enabled: bool, message: String) {
    if let Ok(mut status) = state.status.lock() {
        status.ready = ready;
        status.fts_enabled = fts_enabled;
        status.message = message;
    }
}

fn build_match_query(query: &str) -> String {
    query
        .chars()
        .map(|ch| if ch.is_alphanumeric() || ch.is_whitespace() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .map(|token| format!("\"{}\"", token))
        .collect::<Vec<_>>()
        .join(" OR ")
}

fn initialize_rag_store(path: &PathBuf, entries: &[RagKnowledgeEntry]) -> Result<(), String> {
    let conn = Connection::open(path).map_err(|e| format!("RAG DB 열기 실패: {e}"))?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS knowledge_entries (
          entry_id TEXT PRIMARY KEY,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          keywords TEXT NOT NULL
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
          entry_id UNINDEXED,
          category,
          title,
          content,
          keywords,
          tokenize='unicode61'
        );
        ",
    )
    .map_err(|e| format!("RAG 스키마 초기화 실패: {e}"))?;

    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM knowledge_entries", [], |row| row.get(0))
        .map_err(|e| format!("RAG 데이터 개수 확인 실패: {e}"))?;

    if count == entries.len() as i64 && count > 0 {
        return Ok(());
    }

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("RAG 트랜잭션 시작 실패: {e}"))?;

    tx.execute("DELETE FROM knowledge_entries", [])
        .map_err(|e| format!("RAG 원본 데이터 정리 실패: {e}"))?;
    tx.execute("DELETE FROM knowledge_fts", [])
        .map_err(|e| format!("RAG FTS 데이터 정리 실패: {e}"))?;

    for entry in entries {
        let keywords = entry.keywords.join(" ");
        tx.execute(
            "INSERT INTO knowledge_entries (entry_id, category, title, content, keywords) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![entry.id, entry.category, entry.title, entry.content, keywords],
        )
        .map_err(|e| format!("RAG 원본 데이터 저장 실패: {e}"))?;
        tx.execute(
            "INSERT INTO knowledge_fts (entry_id, category, title, content, keywords) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![entry.id, entry.category, entry.title, entry.content, keywords],
        )
        .map_err(|e| format!("RAG FTS 데이터 저장 실패: {e}"))?;
    }

    tx.commit()
        .map_err(|e| format!("RAG 트랜잭션 커밋 실패: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn initialize_rag(
    app: AppHandle,
    state: State<'_, RagState>,
    entries: Vec<RagKnowledgeEntry>,
) -> Result<RagStatus, String> {
    let path = rag_db_path(&app)?;
    match initialize_rag_store(&path, &entries) {
        Ok(()) => {
            let message = format!("RAG FTS 준비 완료 ({})", path.display());
            update_status(&state, true, true, message.clone());
            Ok(RagStatus {
                ready: true,
                fts_enabled: true,
                message,
            })
        }
        Err(error) => {
            update_status(&state, false, false, error.clone());
            Err(error)
        }
    }
}

#[tauri::command]
pub fn get_rag_status(state: State<'_, RagState>) -> Result<RagStatus, String> {
    state
        .status
        .lock()
        .map(|status| status.clone())
        .map_err(|_| "RAG 상태를 읽지 못했습니다.".to_string())
}

#[tauri::command]
pub fn search_knowledge(
    app: AppHandle,
    state: State<'_, RagState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<RagSearchResult>, String> {
    let match_query = build_match_query(&query);
    if match_query.is_empty() {
        return Ok(Vec::new());
    }

    let path = rag_db_path(&app)?;
    let conn = Connection::open(path).map_err(|e| format!("RAG DB 열기 실패: {e}"))?;
    let max_rows = limit.unwrap_or(3) as i64;

    let mut stmt = conn
        .prepare(
            "
            SELECT entry_id, category, title, content, keywords
            FROM knowledge_fts
            WHERE knowledge_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2
            ",
        )
        .map_err(|e| format!("RAG 검색 준비 실패: {e}"))?;

    let rows = stmt
        .query_map(params![match_query, max_rows], |row| {
            let keywords: String = row.get(4)?;
            Ok(RagSearchResult {
                id: row.get(0)?,
                category: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                keywords: keywords
                    .split_whitespace()
                    .map(|keyword| keyword.to_string())
                    .collect(),
            })
        })
        .map_err(|e| format!("RAG 검색 실행 실패: {e}"))?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| format!("RAG 검색 결과 읽기 실패: {e}"))?);
    }

    update_status(&state, true, true, "RAG FTS 검색 사용 중".to_string());
    Ok(results)
}
