import { beforeEach, describe, expect, it, vi } from 'vitest';

type Phase = 'transfer_window' | 'roster_lock' | 'preseason';

let nextId = 1;
let activeState: {
  id: number;
  save_id: number;
  phase: Phase;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_active: number;
} | null = null;

const executeMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.startsWith('UPDATE offseason_state SET is_active = 0 WHERE save_id')) {
    if (activeState && activeState.save_id === params[0]) activeState.is_active = 0;
    return { rowsAffected: 1 };
  }

  if (sql.startsWith('INSERT INTO offseason_state')) {
    activeState = {
      id: nextId++,
      save_id: params[0] as number,
      phase: params[1] as Phase,
      start_date: params[2] as string,
      end_date: params[3] as string,
      days_remaining: params[4] as number,
      is_active: 1,
    };
    return { lastInsertId: activeState.id };
  }

  if (sql.startsWith('UPDATE offseason_state SET is_active = 0, days_remaining = 0')) {
    if (activeState && activeState.id === params[0]) {
      activeState.is_active = 0;
      activeState.days_remaining = 0;
    }
    return { rowsAffected: 1 };
  }

  if (sql.startsWith('UPDATE offseason_state SET days_remaining =')) {
    if (activeState && activeState.id === params[1]) {
      activeState.days_remaining = params[0] as number;
    }
    return { rowsAffected: 1 };
  }

  return { rowsAffected: 0 };
});

const selectMock = vi.fn(async () => (activeState && activeState.is_active === 1 ? [activeState] : []));

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn(async () => ({
    execute: executeMock,
    select: selectMock,
  })),
}));

describe('offseasonEngine release gates', () => {
  beforeEach(() => {
    nextId = 1;
    activeState = null;
    vi.clearAllMocks();
  });

  it('advances through transfer window, roster lock, preseason, then exits offseason', async () => {
    const { startOffseason, advanceOffseasonDay } = await import('./offseasonEngine');

    const started = await startOffseason(7, '2026-10-01');
    expect(started.phase).toBe('transfer_window');
    expect(started.daysRemaining).toBe(14);

    let state = started;
    for (let day = 0; day < 14; day += 1) {
      state = (await advanceOffseasonDay(7, `2026-10-${String(day + 1).padStart(2, '0')}`)) ?? state;
    }
    expect(activeState?.phase).toBe('roster_lock');

    for (let day = 0; day < 7; day += 1) {
      state = (await advanceOffseasonDay(7, `2026-10-${String(day + 15).padStart(2, '0')}`)) ?? state;
    }
    expect(activeState?.phase).toBe('preseason');

    let finalState: Awaited<ReturnType<typeof advanceOffseasonDay>> | null = null;
    for (let day = 0; day < 7; day += 1) {
      finalState = await advanceOffseasonDay(7, `2026-10-${String(day + 22).padStart(2, '0')}`);
    }

    expect(finalState).toBeNull();
  });
});
