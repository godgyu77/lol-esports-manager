/**
 * 오프시즌 엔진
 * - Phase 1: 이적 윈도우 (14일) — 이적/계약 갱신 가능
 * - Phase 2: 로스터 확정 (7일) — 최종 로스터 제출
 * - Phase 3: 프리시즌 (7일) — 부트캠프 (preseasonEngine 연동)
 */

import { getDatabase } from '../../db/database';
import { addDays } from './calendar';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type OffseasonPhase = 'transfer_window' | 'roster_lock' | 'preseason';

export interface OffseasonState {
  id: number;
  saveId: number;
  phase: OffseasonPhase;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isActive: boolean;
}

/** 페이즈별 일수 */
const PHASE_DURATION: Record<OffseasonPhase, number> = {
  transfer_window: 14,
  roster_lock: 7,
  preseason: 7,
};

/** 페이즈 순서 */
const PHASE_ORDER: OffseasonPhase[] = ['transfer_window', 'roster_lock', 'preseason'];

export const OFFSEASON_PHASE_LABELS: Record<OffseasonPhase, string> = {
  transfer_window: '이적 윈도우',
  roster_lock: '로스터 확정',
  preseason: '프리시즌',
};

// ─────────────────────────────────────────
// DB 매핑
// ─────────────────────────────────────────

interface OffseasonRow {
  id: number;
  save_id: number;
  phase: string;
  start_date: string;
  end_date: string;
  days_remaining: number;
  is_active: number;
}

function mapRowToOffseason(row: OffseasonRow): OffseasonState {
  return {
    id: row.id,
    saveId: row.save_id,
    phase: row.phase as OffseasonPhase,
    startDate: row.start_date,
    endDate: row.end_date,
    daysRemaining: row.days_remaining,
    isActive: row.is_active === 1,
  };
}

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

/**
 * 오프시즌 시작
 * 시즌 종료 후 호출. 이적 윈도우 페이즈부터 시작.
 */
export async function startOffseason(saveId: number, startDate: string): Promise<OffseasonState> {
  const db = await getDatabase();

  // 기존 활성 오프시즌 비활성화
  await db.execute(
    'UPDATE offseason_state SET is_active = 0 WHERE save_id = $1 AND is_active = 1',
    [saveId],
  );

  const phase: OffseasonPhase = 'transfer_window';
  const duration = PHASE_DURATION[phase];
  const endDate = addDays(startDate, duration);

  const result = await db.execute(
    `INSERT INTO offseason_state (save_id, phase, start_date, end_date, days_remaining, is_active)
     VALUES ($1, $2, $3, $4, $5, 1)`,
    [saveId, phase, startDate, endDate, duration],
  );

  return {
    id: result.lastInsertId as number,
    saveId,
    phase,
    startDate,
    endDate,
    daysRemaining: duration,
    isActive: true,
  };
}

/**
 * 오프시즌 하루 진행
 * daysRemaining 감소, 0이면 다음 페이즈로 전환.
 * 마지막 페이즈가 끝나면 오프시즌 종료 (isActive = false).
 * @returns 갱신된 오프시즌 상태 (null이면 오프시즌 종료)
 */
export async function advanceOffseasonDay(
  saveId: number,
  date: string,
): Promise<OffseasonState | null> {
  const current = await getCurrentOffseasonState(saveId);
  if (!current) return null;

  const newDaysRemaining = current.daysRemaining - 1;

  if (newDaysRemaining <= 0) {
    // 다음 페이즈로 전환
    const currentIndex = PHASE_ORDER.indexOf(current.phase);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= PHASE_ORDER.length) {
      // 모든 페이즈 완료 → 오프시즌 종료
      const db = await getDatabase();
      await db.execute(
        'UPDATE offseason_state SET is_active = 0, days_remaining = 0 WHERE id = $1',
        [current.id],
      );
      return null;
    }

    // 다음 페이즈 시작
    const nextPhase = PHASE_ORDER[nextIndex];
    const nextDuration = PHASE_DURATION[nextPhase];
    const nextStartDate = addDays(date, 1);
    const nextEndDate = addDays(nextStartDate, nextDuration);

    const db = await getDatabase();
    // 현재 페이즈 비활성화
    await db.execute(
      'UPDATE offseason_state SET is_active = 0, days_remaining = 0 WHERE id = $1',
      [current.id],
    );

    // 새 페이즈 생성
    const result = await db.execute(
      `INSERT INTO offseason_state (save_id, phase, start_date, end_date, days_remaining, is_active)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [saveId, nextPhase, nextStartDate, nextEndDate, nextDuration],
    );

    return {
      id: result.lastInsertId as number,
      saveId,
      phase: nextPhase,
      startDate: nextStartDate,
      endDate: nextEndDate,
      daysRemaining: nextDuration,
      isActive: true,
    };
  }

  // 같은 페이즈 계속
  const db = await getDatabase();
  await db.execute(
    'UPDATE offseason_state SET days_remaining = $1 WHERE id = $2',
    [newDaysRemaining, current.id],
  );

  return {
    ...current,
    daysRemaining: newDaysRemaining,
  };
}

/**
 * 현재 오프시즌 페이즈 조회
 */
export async function getCurrentOffseasonPhase(saveId: number): Promise<OffseasonPhase | null> {
  const state = await getCurrentOffseasonState(saveId);
  return state?.phase ?? null;
}

/**
 * 오프시즌 여부 확인
 */
export async function isInOffseason(saveId: number): Promise<boolean> {
  const state = await getCurrentOffseasonState(saveId);
  return state !== null;
}

/**
 * 현재 활성 오프시즌 상태 조회
 */
export async function getCurrentOffseasonState(saveId: number): Promise<OffseasonState | null> {
  const db = await getDatabase();
  const rows = await db.select<OffseasonRow[]>(
    'SELECT * FROM offseason_state WHERE save_id = $1 AND is_active = 1 LIMIT 1',
    [saveId],
  );
  if (rows.length === 0) return null;
  return mapRowToOffseason(rows[0]);
}
