import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:lol_esports_manager.db');
    await db.execute('PRAGMA journal_mode = WAL');
    await db.execute('PRAGMA foreign_keys = ON');
  }
  return db;
}

/** 트랜잭션 래퍼 — 실패 시 자동 ROLLBACK */
export async function withTransaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  const conn = await getDatabase();
  await conn.execute('BEGIN TRANSACTION');
  try {
    const result = await fn(conn);
    await conn.execute('COMMIT');
    return result;
  } catch (err) {
    await conn.execute('ROLLBACK');
    throw err;
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
