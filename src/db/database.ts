import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let txLock = false;

export async function getDatabase(): Promise<Database> {
  if (!db) {
    try {
      db = await Database.load('sqlite:lol_esports_manager.db');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[database] DB 로드 실패:', msg);

      if (msg.includes('migration')) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('mark_db_for_reset');
          console.warn('[database] DB 리셋 마커 생성 완료');
        } catch (recoveryError) {
          console.error('[database] 자동 복구 준비 실패:', recoveryError);
        }

        throw new Error(
          '데이터베이스 구조가 현재 버전과 맞지 않습니다. 설정에서 데이터 초기화를 실행한 뒤 다시 시도해 주세요.',
        );
      }

      throw err;
    }

    await db.execute('PRAGMA journal_mode = WAL');
    await db.execute('PRAGMA busy_timeout = 15000');
    await db.execute('PRAGMA foreign_keys = ON');
  }

  return db;
}

export async function withTransaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  while (txLock) {
    await new Promise((resolve) => setTimeout(resolve, 50));
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
