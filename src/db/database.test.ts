import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadMock = vi.fn();

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: loadMock,
  },
}));

type FakeDb = {
  execute: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

function createFakeDb(options?: {
  failBeginCount?: number;
}) {
  let remainingBeginFailures = options?.failBeginCount ?? 0;
  const calls: string[] = [];
  const db: FakeDb = {
    execute: vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql === 'BEGIN TRANSACTION' && remainingBeginFailures > 0) {
        remainingBeginFailures -= 1;
        throw new Error('begin failed');
      }
      return { lastInsertId: 1 };
    }),
    close: vi.fn(async () => {}),
  };

  return { db, calls };
}

describe('database', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('releases txLock when getDatabase fails before BEGIN', async () => {
    const { db } = createFakeDb();
    loadMock
      .mockRejectedValueOnce(new Error('load failed'))
      .mockResolvedValue(db);

    const { withTransaction } = await import('./database');

    await expect(withTransaction(async () => 'nope')).rejects.toThrow('load failed');
    await expect(withTransaction(async () => 'ok')).resolves.toBe('ok');
  });

  it('releases txLock when BEGIN TRANSACTION fails', async () => {
    const { db, calls } = createFakeDb({ failBeginCount: 1 });
    loadMock.mockResolvedValue(db);

    const { getDatabase, withTransaction } = await import('./database');

    await getDatabase();
    await expect(withTransaction(async () => 'nope')).rejects.toThrow('begin failed');
    await expect(withTransaction(async () => 'ok')).resolves.toBe('ok');

    expect(calls.filter((sql) => sql === 'ROLLBACK')).toHaveLength(0);
    expect(calls.filter((sql) => sql === 'COMMIT')).toHaveLength(1);
  });
});
