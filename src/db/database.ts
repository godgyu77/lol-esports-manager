import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let txLock = false;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:lol_esports_manager.db');
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
