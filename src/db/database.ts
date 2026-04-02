import { invoke } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

export const META_DATABASE_FILE = 'index.db';
export const AUTOSAVE_DATABASE_FILE = 'autosave.db';
const DEFAULT_ACTIVE_DATABASE_FILE = AUTOSAVE_DATABASE_FILE;

let activeDb: Database | null = null;
let metaDb: Database | null = null;
let txLock = false;
let repairsApplied = false;
let activeDatabaseFile = DEFAULT_ACTIVE_DATABASE_FILE;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDatabaseFileLockError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return normalized.includes('database is locked')
    || normalized.includes('database busy')
    || normalized.includes('code: 5')
    || normalized.includes('used by another process')
    || normalized.includes('cannot access the file');
}

function toDatabaseUrl(fileName: string): string {
  return `sqlite:${fileName}`;
}

async function repairLegacyDerivedData(conn: Database): Promise<void> {
  if (repairsApplied) return;

  try {
    await conn.execute(
      `UPDATE player_career_stats
       SET total_damage = COALESCE((
         SELECT SUM(damage_dealt)
         FROM player_game_stats
         WHERE player_id = player_career_stats.player_id
       ), 0)`,
    );
  } catch (err) {
    console.warn('[database] legacy career damage repair skipped:', err);
  } finally {
    repairsApplied = true;
  }
}

async function loadDatabase(fileName: string): Promise<Database> {
  return Database.load(toDatabaseUrl(fileName));
}

async function initializeConnection(conn: Database, applyLegacyRepair: boolean): Promise<void> {
  await conn.execute('PRAGMA journal_mode = WAL');
  await conn.execute('PRAGMA busy_timeout = 15000');
  await conn.execute('PRAGMA foreign_keys = ON');

  if (applyLegacyRepair) {
    await repairLegacyDerivedData(conn);
  }
}

export function getGameDatabaseFileName(slotNumber: number): string {
  return slotNumber === 0 ? AUTOSAVE_DATABASE_FILE : `slot_${slotNumber}.db`;
}

export function getActiveGameDatabaseName(): string {
  return activeDatabaseFile;
}

export async function getMetaDatabase(): Promise<Database> {
  if (!metaDb) {
    metaDb = await loadDatabase(META_DATABASE_FILE);
    await initializeConnection(metaDb, false);
  }

  return metaDb;
}

export async function getDatabase(): Promise<Database> {
  if (!activeDb) {
    try {
      activeDb = await loadDatabase(activeDatabaseFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[database] failed to load game DB:', msg);

      if (msg.includes('migration')) {
        try {
          await invoke('mark_db_for_reset');
          console.warn('[database] DB reset marker created after migration failure');
        } catch (recoveryError) {
          console.error('[database] failed to mark DB for reset:', recoveryError);
        }

        throw new Error(
          '데이터베이스 구조가 현재 버전과 맞지 않습니다. 설정에서 데이터를 초기화한 뒤 다시 시도해 주세요.',
        );
      }

      throw err;
    }

    await initializeConnection(activeDb, true);
  }

  return activeDb;
}

export async function setActiveGameDatabase(fileName: string): Promise<void> {
  if (activeDatabaseFile === fileName && activeDb) {
    return;
  }

  await closeDatabase();
  activeDatabaseFile = fileName;
}

export async function checkpointActiveGameDatabase(): Promise<void> {
  const conn = await getDatabase();
  await conn.execute('PRAGMA wal_checkpoint(TRUNCATE)');
}

export async function gameDatabaseExists(fileName: string): Promise<boolean> {
  return invoke<boolean>('game_database_exists', { fileName });
}

export async function prepareForDatabaseFileMutation(): Promise<void> {
  while (txLock) {
    await delay(50);
  }

  if (!activeDb) {
    return;
  }

  try {
    await checkpointActiveGameDatabase();
  } catch (error) {
    console.warn('[database] checkpoint before file mutation skipped:', error);
  }

  await closeDatabase();
  await delay(50);
}

export async function runDatabaseFileMutationWithRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prepareForDatabaseFileMutation();
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isDatabaseFileLockError(error) || attempt === maxAttempts) {
        throw error;
      }
      await delay(attempt * 100);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function copyGameDatabase(sourceFileName: string, targetFileName: string): Promise<void> {
  await runDatabaseFileMutationWithRetry(() => invoke('copy_game_database_files', {
    sourceFileName,
    targetFileName,
  }));
}

export async function deleteGameDatabase(fileName: string): Promise<void> {
  await runDatabaseFileMutationWithRetry(() => invoke('delete_game_database_files', {
    fileName,
  }));
}

export async function withTransaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  while (txLock) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  txLock = true;
  let transactionStarted = false;

  try {
    const conn = await getDatabase();
    await conn.execute('BEGIN TRANSACTION');
    transactionStarted = true;

    const result = await fn(conn);
    await conn.execute('COMMIT');
    return result;
  } catch (err) {
    if (transactionStarted) {
      const conn = await getDatabase().catch(() => null);
      await conn?.execute('ROLLBACK').catch(() => {});
    }
    throw err;
  } finally {
    txLock = false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (activeDb) {
    await activeDb.close();
    activeDb = null;
    repairsApplied = false;
  }
}

export async function closeMetaDatabase(): Promise<void> {
  if (metaDb) {
    await metaDb.close();
    metaDb = null;
  }
}
