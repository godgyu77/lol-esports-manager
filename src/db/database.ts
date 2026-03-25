import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let txLock = false;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    try {
      db = await Database.load('sqlite:lol_esports_manager.db');
    } catch (err) {
      // 마이그레이션 체크섬 불일치 등 — 마커 파일 생성 후 앱 재시작
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[database] DB 로드 실패 (마이그레이션 오류):', msg);
      if (msg.includes('migration')) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('mark_db_for_reset');
          console.warn('[database] DB 리셋 마커 생성 완료, 앱을 재시작합니다.');
          const proc = await import('@tauri-apps/plugin-process');
          await proc.exit(0);
        } catch (e) {
          console.error('[database] 자동 복구 실패:', e);
        }
      }
      throw err;
    }
    await db.execute('PRAGMA journal_mode = WAL');
    await db.execute('PRAGMA busy_timeout = 15000');
    await db.execute('PRAGMA foreign_keys = ON');
  }
  return db;
}

/** 트랜잭션 래퍼 — 직렬화 보장 (중첩 방지) */
export async function withTransaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  // 이미 트랜잭션 진행 중이면 대기
  while (txLock) {
    await new Promise(r => setTimeout(r, 50));
  }
  txLock = true;
  const conn = await getDatabase();
  await conn.execute('BEGIN TRANSACTION');
  try {
    const result = await fn(conn);
    await conn.execute('COMMIT');
    return result;
  } catch (err) {
    await conn.execute('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    txLock = false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
