/**
 * tacticsEngine 단위 테스트
 * - 순수 함수만 테스트 (DB 의존 함수 제외)
 * - calculateTacticsBonus, calculateRoleBonuses, calculateCounterBonus, checkTacticalAdjustment
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTacticsBonus,
  calculateRoleBonuses,
  calculateCounterBonus,
  checkTacticalAdjustment,
} from './tacticsEngine';
import type { TeamTactics } from '../../types/tactics';
import type { Position } from '../../types/game';

// ─────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────

function createMockTactics(overrides: Partial<TeamTactics> = {}): TeamTactics {
  return {
    teamId: 'team_test',
    earlyStrategy: 'standard',
    midStrategy: 'balanced',
    lateStrategy: 'teamfight',
    wardPriority: 'balanced',
    dragonPriority: 5,
    baronPriority: 5,
    aggressionLevel: 5,
    ...overrides,
  };
}

function createPlayerStats(overrides: Partial<Record<Position, { aggression: number; laning: number; gameSense: number }>> = {}) {
  const defaults: Record<Position, { aggression: number; laning: number; gameSense: number }> = {
    top: { aggression: 60, laning: 65, gameSense: 55 },
    jungle: { aggression: 70, laning: 50, gameSense: 60 },
    mid: { aggression: 65, laning: 70, gameSense: 65 },
    adc: { aggression: 55, laning: 75, gameSense: 60 },
    support: { aggression: 50, laning: 55, gameSense: 70 },
  };
  return { ...defaults, ...overrides };
}

// ─────────────────────────────────────────
// calculateTacticsBonus 테스트
// ─────────────────────────────────────────

describe('calculateTacticsBonus', () => {
  it('표준 전술(기본값)은 모든 보정이 0', () => {
    const tactics = createMockTactics();
    const bonus = calculateTacticsBonus(tactics);

    expect(bonus.earlyBonus).toBe(0);
    expect(bonus.midBonus).toBe(0);
    expect(bonus.lateBonus).toBe(0);
    expect(bonus.objectiveBonus).toBe(0);
  });

  it('인베이드 전략은 earlyBonus +0.08', () => {
    const tactics = createMockTactics({ earlyStrategy: 'invade' });
    const bonus = calculateTacticsBonus(tactics);

    expect(bonus.earlyBonus).toBe(0.08);
  });

  it('안전 파밍 전략은 earlyBonus -0.04', () => {
    const tactics = createMockTactics({ earlyStrategy: 'safe_farm' });
    const bonus = calculateTacticsBonus(tactics);

    expect(bonus.earlyBonus).toBe(-0.04);
  });

  it('공격성 높으면 earlyBonus 증가, lateBonus 감소', () => {
    const aggressive = createMockTactics({ aggressionLevel: 8 });
    const bonus = calculateTacticsBonus(aggressive);

    // aggressionOffset = (8 - 5) * 0.01 = 0.03
    expect(bonus.earlyBonus).toBe(0.03);
    expect(bonus.lateBonus).toBe(-0.03);
  });

  it('공격성 낮으면 earlyBonus 감소, lateBonus 증가', () => {
    const passive = createMockTactics({ aggressionLevel: 2 });
    const bonus = calculateTacticsBonus(passive);

    // aggressionOffset = (2 - 5) * 0.01 = -0.03
    expect(bonus.earlyBonus).toBe(-0.03);
    expect(bonus.lateBonus).toBe(0.03);
  });

  it('드래곤/바론 우선도 높으면 objectiveBonus 양수', () => {
    const objFocus = createMockTactics({ dragonPriority: 9, baronPriority: 9 });
    const bonus = calculateTacticsBonus(objFocus);

    // objectiveBonus = ((9 + 9) / 2 - 5) * 0.02 = 4 * 0.02 = 0.08
    expect(bonus.objectiveBonus).toBeCloseTo(0.08);
  });

  it('pick_comp 중반 전략은 midBonus +0.06', () => {
    const tactics = createMockTactics({ midStrategy: 'pick_comp' });
    const bonus = calculateTacticsBonus(tactics);

    expect(bonus.midBonus).toBe(0.06);
  });

  it('시즈 후반 전략은 lateBonus +0.06', () => {
    const tactics = createMockTactics({ lateStrategy: 'siege' });
    const bonus = calculateTacticsBonus(tactics);

    expect(bonus.lateBonus).toBe(0.06);
  });
});

// ─────────────────────────────────────────
// calculateRoleBonuses 테스트
// ─────────────────────────────────────────

describe('calculateRoleBonuses', () => {
  it('roleInstructions가 없으면 빈 배열 반환', () => {
    const result = calculateRoleBonuses(undefined, createPlayerStats());
    expect(result).toHaveLength(0);
  });

  it('정글 gank_heavy 지시 시 gankSuccessBonus 양수', () => {
    const instructions = {
      top: 'play_safe' as const,
      jungle: 'gank_heavy' as const,
      mid: 'play_safe' as const,
      adc: 'play_safe' as const,
      support: 'protect_adc' as const,
    };

    const result = calculateRoleBonuses(instructions, createPlayerStats());
    const jungle = result.find(r => r.position === 'jungle');

    expect(jungle).toBeDefined();
    expect(jungle!.gankSuccessBonus).toBeGreaterThan(0);
  });

  it('정글 farm_heavy 지시 시 gankSuccessBonus 음수, objectiveBonus 양수', () => {
    const instructions = {
      top: 'play_safe' as const,
      jungle: 'farm_heavy' as const,
      mid: 'play_safe' as const,
      adc: 'play_safe' as const,
      support: 'protect_adc' as const,
    };

    const result = calculateRoleBonuses(instructions, createPlayerStats());
    const jungle = result.find(r => r.position === 'jungle');

    expect(jungle!.gankSuccessBonus).toBe(-0.04);
    expect(jungle!.objectiveBonus).toBe(0.02);
  });

  it('라인 roam 지시 시 roamBonus 양수, laningBonus 음수', () => {
    const instructions = {
      top: 'roam' as const,
      jungle: 'gank_heavy' as const,
      mid: 'roam' as const,
      adc: 'play_safe' as const,
      support: 'protect_adc' as const,
    };

    const result = calculateRoleBonuses(instructions, createPlayerStats());
    const mid = result.find(r => r.position === 'mid');

    expect(mid!.roamBonus).toBe(0.06);
    expect(mid!.laningBonus).toBe(-0.02);
  });

  it('서포트 roam_mid 지시 시 roamBonus와 gankBonus 양수', () => {
    const instructions = {
      top: 'play_safe' as const,
      jungle: 'gank_heavy' as const,
      mid: 'play_safe' as const,
      adc: 'play_safe' as const,
      support: 'roam_mid' as const,
    };

    const result = calculateRoleBonuses(instructions, createPlayerStats());
    const support = result.find(r => r.position === 'support');

    expect(support!.roamBonus).toBe(0.06);
    expect(support!.gankSuccessBonus).toBe(0.04);
  });

  it('5개 포지션 전부 보너스 반환', () => {
    const instructions = {
      top: 'play_safe' as const,
      jungle: 'gank_heavy' as const,
      mid: 'aggressive_trade' as const,
      adc: 'freeze' as const,
      support: 'engage_primary' as const,
    };

    const result = calculateRoleBonuses(instructions, createPlayerStats());

    expect(result).toHaveLength(5);
    const positions = result.map(r => r.position);
    expect(positions).toContain('top');
    expect(positions).toContain('jungle');
    expect(positions).toContain('mid');
    expect(positions).toContain('adc');
    expect(positions).toContain('support');
  });
});

// ─────────────────────────────────────────
// calculateCounterBonus 테스트
// ─────────────────────────────────────────

describe('calculateCounterBonus', () => {
  it('같은 유형끼리는 0', () => {
    const a = createMockTactics({ aggressionLevel: 8, earlyStrategy: 'invade' }); // aggressive
    const b = createMockTactics({ aggressionLevel: 8, earlyStrategy: 'invade' }); // aggressive

    expect(calculateCounterBonus(a, b)).toBe(0);
  });

  it('aggressive vs split → aggressive가 유리 (+0.03)', () => {
    const aggressive = createMockTactics({ aggressionLevel: 8 }); // aggressive
    const split = createMockTactics({ midStrategy: 'split_push' }); // split

    expect(calculateCounterBonus(aggressive, split)).toBe(0.03);
  });

  it('split vs controlled → split가 유리 (+0.03)', () => {
    const split = createMockTactics({ midStrategy: 'split_push' }); // split
    const controlled = createMockTactics({ midStrategy: 'objective_control' }); // controlled

    expect(calculateCounterBonus(split, controlled)).toBe(0.03);
  });

  it('controlled vs aggressive → controlled가 유리 (+0.03)', () => {
    const controlled = createMockTactics({ midStrategy: 'objective_control' }); // controlled
    const aggressive = createMockTactics({ aggressionLevel: 8 }); // aggressive

    expect(calculateCounterBonus(controlled, aggressive)).toBe(0.03);
  });

  it('불리한 상성은 -0.03', () => {
    const split = createMockTactics({ midStrategy: 'split_push' }); // split
    const aggressive = createMockTactics({ aggressionLevel: 8 }); // aggressive

    expect(calculateCounterBonus(split, aggressive)).toBe(-0.03);
  });
});

// ─────────────────────────────────────────
// checkTacticalAdjustment 테스트
// ─────────────────────────────────────────

describe('checkTacticalAdjustment', () => {
  it('tacticalAdjustments가 없으면 null 반환', () => {
    const tactics = createMockTactics();
    expect(checkTacticalAdjustment(tactics, 6000, true)).toBeNull();
  });

  it('빈 배열이면 null 반환', () => {
    const tactics = createMockTactics({ tacticalAdjustments: [] });
    expect(checkTacticalAdjustment(tactics, 6000, true)).toBeNull();
  });

  it('gold_lead_5k 트리거: 골드 5000 이상이면 전술 전환', () => {
    const tactics = createMockTactics({
      tacticalAdjustments: [{
        trigger: 'gold_lead_5k',
        switchTo: { midStrategy: 'split_push', aggressionLevel: 8 },
      }],
    });

    const result = checkTacticalAdjustment(tactics, 6000, true);
    expect(result).not.toBeNull();
    // split_push midBonus = 0.04, aggressionLevel 8 → offset +0.03
    expect(result!.midBonus).toBe(0.04);
    expect(result!.earlyBonus).toBeCloseTo(0.03);
  });

  it('gold_lead_5k 트리거: 골드 4000이면 전환 없음', () => {
    const tactics = createMockTactics({
      tacticalAdjustments: [{
        trigger: 'gold_lead_5k',
        switchTo: { midStrategy: 'split_push' },
      }],
    });

    expect(checkTacticalAdjustment(tactics, 4000, true)).toBeNull();
  });

  it('gold_behind_5k 트리거: 골드 -5000 이하에서 전환', () => {
    const tactics = createMockTactics({
      tacticalAdjustments: [{
        trigger: 'gold_behind_5k',
        switchTo: { lateStrategy: 'siege' },
      }],
    });

    const result = checkTacticalAdjustment(tactics, -6000, false);
    expect(result).not.toBeNull();
    expect(result!.lateBonus).toBe(0.06); // siege = 0.06
  });

  it('winning_early 트리거: 이기고 있고 골드 양수일 때', () => {
    const tactics = createMockTactics({
      tacticalAdjustments: [{
        trigger: 'winning_early',
        switchTo: { aggressionLevel: 9 },
      }],
    });

    const result = checkTacticalAdjustment(tactics, 2000, true);
    expect(result).not.toBeNull();
  });

  it('winning_early 트리거: 골드가 0 이하면 전환 안됨', () => {
    const tactics = createMockTactics({
      tacticalAdjustments: [{
        trigger: 'winning_early',
        switchTo: { aggressionLevel: 9 },
      }],
    });

    expect(checkTacticalAdjustment(tactics, -100, true)).toBeNull();
  });

  it('첫 번째 매칭 트리거만 실행됨', () => {
    const tactics = createMockTactics({
      tacticalAdjustments: [
        { trigger: 'gold_lead_5k', switchTo: { midStrategy: 'pick_comp' } },
        { trigger: 'gold_lead_5k', switchTo: { midStrategy: 'split_push' } },
      ],
    });

    const result = checkTacticalAdjustment(tactics, 6000, true);
    expect(result).not.toBeNull();
    expect(result!.midBonus).toBe(0.06); // pick_comp = 0.06
  });
});
