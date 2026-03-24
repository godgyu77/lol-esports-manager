/**
 * boardEngine 단위 테스트
 * - 내부 순수 함수 (getTargetStanding, expectsPlayoff, expectsInternational, clamp)의
 *   동작을 공개 함수 initBoardExpectations를 통해 간접 검증
 * - DB 의존 함수는 모킹하여 핵심 비즈니스 로직을 검증
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────
// DB 모킹
// ─────────────────────────────────────────

const mockExecute = vi.fn().mockResolvedValue({ rowsAffected: 1 });
const mockSelect = vi.fn().mockResolvedValue([]);

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn().mockResolvedValue({
    execute: (...args: unknown[]) => mockExecute(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}));

import {
  initBoardExpectations,
  getBoardExpectations,
} from './boardEngine';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────
// initBoardExpectations 테스트 (간접적으로 내부 순수 함수 검증)
// ─────────────────────────────────────────

describe('initBoardExpectations', () => {
  it('명성 90+ → 목표 순위 1위, 플레이오프 기대, 국제대회 기대', async () => {
    const result = await initBoardExpectations('team_1', 1, 95);

    expect(result.targetStanding).toBe(1);
    expect(result.targetPlayoff).toBe(true);
    expect(result.targetInternational).toBe(true);
    expect(result.satisfaction).toBe(50);
    expect(result.fanHappiness).toBe(50);
    expect(result.warningCount).toBe(0);
    expect(result.isFired).toBe(false);
  });

  it('명성 80~89 → 목표 순위 2위, 국제대회 기대', async () => {
    const result = await initBoardExpectations('team_1', 1, 85);

    expect(result.targetStanding).toBe(2);
    expect(result.targetPlayoff).toBe(true);
    expect(result.targetInternational).toBe(true);
  });

  it('명성 70~79 → 목표 순위 3위, 플레이오프 기대, 국제대회 미기대', async () => {
    const result = await initBoardExpectations('team_1', 1, 75);

    expect(result.targetStanding).toBe(3);
    expect(result.targetPlayoff).toBe(true);
    expect(result.targetInternational).toBe(false);
  });

  it('명성 55~69 → 목표 순위 4위, 플레이오프 기대', async () => {
    const result = await initBoardExpectations('team_1', 1, 60);

    expect(result.targetStanding).toBe(4);
    expect(result.targetPlayoff).toBe(true);
    expect(result.targetInternational).toBe(false);
  });

  it('명성 40~54 → 목표 순위 6위, 플레이오프 미기대', async () => {
    const result = await initBoardExpectations('team_1', 1, 45);

    expect(result.targetStanding).toBe(6);
    expect(result.targetPlayoff).toBe(false);
    expect(result.targetInternational).toBe(false);
  });

  it('명성 40 미만 → 목표 순위 8위', async () => {
    const result = await initBoardExpectations('team_1', 1, 20);

    expect(result.targetStanding).toBe(8);
    expect(result.targetPlayoff).toBe(false);
    expect(result.targetInternational).toBe(false);
  });

  it('DB execute가 올바른 파라미터로 호출됨', async () => {
    await initBoardExpectations('team_t1', 2, 90);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const args = mockExecute.mock.calls[0];
    expect(args[1]).toEqual(['team_t1', 2, 1, 1, 1, 50, 50]);
  });
});

// ─────────────────────────────────────────
// getBoardExpectations 테스트
// ─────────────────────────────────────────

describe('getBoardExpectations', () => {
  it('행이 없으면 null 반환', async () => {
    mockSelect.mockResolvedValueOnce([]);
    const result = await getBoardExpectations('team_1', 1);

    expect(result).toBeNull();
  });

  it('행이 있으면 올바르게 매핑', async () => {
    mockSelect.mockResolvedValueOnce([{
      id: 1,
      team_id: 'team_1',
      season_id: 1,
      target_standing: 3,
      target_playoff: 1,
      target_international: 0,
      satisfaction: 65,
      fan_happiness: 70,
      warning_count: 1,
      is_fired: 0,
    }]);

    const result = await getBoardExpectations('team_1', 1);

    expect(result).not.toBeNull();
    expect(result!.teamId).toBe('team_1');
    expect(result!.targetStanding).toBe(3);
    expect(result!.targetPlayoff).toBe(true);
    expect(result!.targetInternational).toBe(false);
    expect(result!.satisfaction).toBe(65);
    expect(result!.fanHappiness).toBe(70);
    expect(result!.warningCount).toBe(1);
    expect(result!.isFired).toBe(false);
  });
});
