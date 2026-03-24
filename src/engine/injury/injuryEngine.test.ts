/**
 * injuryEngine 단위 테스트
 * - 순수 함수 (formatInjuryEvent, calculateRecoveryProgress)만 테스트
 * - DB 의존 함수 (checkForInjuries, advanceInjuryDay 등)는 제외
 */

import { describe, it, expect } from 'vitest';
import { formatInjuryEvent, calculateRecoveryProgress } from './injuryEngine';
import type { PlayerInjury } from '../../types/injury';

// ─────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────

function createMockInjury(overrides: Partial<PlayerInjury> = {}): PlayerInjury {
  return {
    id: 1,
    playerId: 'player_1',
    teamId: 'team_1',
    injuryType: 'wrist',
    severity: 1,
    daysRemaining: 5,
    occurredDate: '2026-01-01',
    expectedReturn: '2026-01-06',
    isRecovered: false,
    ...overrides,
  };
}

// ─────────────────────────────────────────
// formatInjuryEvent 테스트
// ─────────────────────────────────────────

describe('formatInjuryEvent', () => {
  it('손목 부상 이벤트 텍스트 포맷', () => {
    const injury = createMockInjury({ injuryType: 'wrist', daysRemaining: 5 });
    const text = formatInjuryEvent('Faker', injury);

    expect(text).toBe('Faker — 손목 부상 (5일 결장)');
  });

  it('허리 통증 이벤트 텍스트 포맷', () => {
    const injury = createMockInjury({ injuryType: 'back', daysRemaining: 14 });
    const text = formatInjuryEvent('Zeus', injury);

    expect(text).toBe('Zeus — 허리 통증 (14일 결장)');
  });

  it('안구 피로 이벤트 텍스트 포맷', () => {
    const injury = createMockInjury({ injuryType: 'eye', daysRemaining: 3 });
    const text = formatInjuryEvent('Gumayusi', injury);

    expect(text).toBe('Gumayusi — 안구 피로 (3일 결장)');
  });

  it('번아웃 이벤트 텍스트 포맷', () => {
    const injury = createMockInjury({ injuryType: 'mental_burnout', daysRemaining: 10 });
    const text = formatInjuryEvent('Keria', injury);

    expect(text).toBe('Keria — 번아웃 (10일 결장)');
  });

  it('경미한 부상 이벤트 텍스트 포맷', () => {
    const injury = createMockInjury({ injuryType: 'minor', daysRemaining: 3 });
    const text = formatInjuryEvent('Oner', injury);

    expect(text).toBe('Oner — 경미한 부상 (3일 결장)');
  });
});

// ─────────────────────────────────────────
// calculateRecoveryProgress 테스트
// ─────────────────────────────────────────

describe('calculateRecoveryProgress', () => {
  it('severity 1 (최대 7일): 남은 0일 → 100%', () => {
    const injury = createMockInjury({ severity: 1, daysRemaining: 0 });
    const progress = calculateRecoveryProgress(injury);

    expect(progress).toBe(100);
  });

  it('severity 1 (최대 7일): 남은 7일 → 0%', () => {
    const injury = createMockInjury({ severity: 1, daysRemaining: 7 });
    const progress = calculateRecoveryProgress(injury);

    expect(progress).toBe(0);
  });

  it('severity 1 (최대 7일): 남은 3일 → ~57%', () => {
    const injury = createMockInjury({ severity: 1, daysRemaining: 3 });
    const progress = calculateRecoveryProgress(injury);

    // elapsed = 7 - 3 = 4, (4/7)*100 = 57.14
    expect(progress).toBe(57);
  });

  it('severity 2 (최대 21일): 남은 10일 → ~52%', () => {
    const injury = createMockInjury({ severity: 2, daysRemaining: 10 });
    const progress = calculateRecoveryProgress(injury);

    // elapsed = 21 - 10 = 11, (11/21)*100 = 52.38
    expect(progress).toBe(52);
  });

  it('severity 3 (최대 42일): 남은 21일 → 50%', () => {
    const injury = createMockInjury({ severity: 3, daysRemaining: 21 });
    const progress = calculateRecoveryProgress(injury);

    // elapsed = 42 - 21 = 21, (21/42)*100 = 50
    expect(progress).toBe(50);
  });

  it('0~100 범위 내로 클램프', () => {
    // 남은 일수가 최대보다 많은 경우 (가속 회복 등으로 가능)
    const injury = createMockInjury({ severity: 1, daysRemaining: -5 });
    const progress = calculateRecoveryProgress(injury);

    expect(progress).toBe(100);
  });

  it('유효하지 않은 severity는 0 반환', () => {
    const injury = createMockInjury({ severity: 99 });
    const progress = calculateRecoveryProgress(injury);

    expect(progress).toBe(0);
  });
});
