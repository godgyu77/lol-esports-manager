/**
 * 전술 엔진
 * - 팀 전술 CRUD
 * - 기본 전술 초기화
 * - 전술 보정 효과 계산
 */

import { getDatabase } from '../../db/database';
import type {
  TeamTactics,
  EarlyStrategy,
  MidStrategy,
  LateStrategy,
  WardPriority,
} from '../../types/tactics';

// ─────────────────────────────────────────
// Row 타입
// ─────────────────────────────────────────

interface TacticsRow {
  team_id: string;
  early_strategy: string;
  mid_strategy: string;
  late_strategy: string;
  ward_priority: string;
  dragon_priority: number;
  baron_priority: number;
  aggression_level: number;
}

// ─────────────────────────────────────────
// 전술 보정 효과 타입
// ─────────────────────────────────────────

export interface TacticsBonus {
  earlyBonus: number;
  midBonus: number;
  lateBonus: number;
  objectiveBonus: number;
}

// ─────────────────────────────────────────
// 전술 조회
// ─────────────────────────────────────────

export async function getTeamTactics(teamId: string): Promise<TeamTactics | null> {
  const db = await getDatabase();
  const rows = await db.select<TacticsRow[]>(
    'SELECT * FROM team_tactics WHERE team_id = $1',
    [teamId],
  );

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    teamId: r.team_id,
    earlyStrategy: r.early_strategy as EarlyStrategy,
    midStrategy: r.mid_strategy as MidStrategy,
    lateStrategy: r.late_strategy as LateStrategy,
    wardPriority: r.ward_priority as WardPriority,
    dragonPriority: r.dragon_priority,
    baronPriority: r.baron_priority,
    aggressionLevel: r.aggression_level,
  };
}

// ─────────────────────────────────────────
// 전술 저장
// ─────────────────────────────────────────

export async function setTeamTactics(teamId: string, tactics: Omit<TeamTactics, 'teamId'>): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO team_tactics (team_id, early_strategy, mid_strategy, late_strategy, ward_priority, dragon_priority, baron_priority, aggression_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(team_id) DO UPDATE SET
       early_strategy = $2,
       mid_strategy = $3,
       late_strategy = $4,
       ward_priority = $5,
       dragon_priority = $6,
       baron_priority = $7,
       aggression_level = $8`,
    [
      teamId,
      tactics.earlyStrategy,
      tactics.midStrategy,
      tactics.lateStrategy,
      tactics.wardPriority,
      tactics.dragonPriority,
      tactics.baronPriority,
      tactics.aggressionLevel,
    ],
  );
}

// ─────────────────────────────────────────
// 기본 전술 초기화
// ─────────────────────────────────────────

export async function initDefaultTactics(teamId: string): Promise<void> {
  await setTeamTactics(teamId, {
    earlyStrategy: 'standard',
    midStrategy: 'balanced',
    lateStrategy: 'teamfight',
    wardPriority: 'balanced',
    dragonPriority: 5,
    baronPriority: 5,
    aggressionLevel: 5,
  });
}

// ─────────────────────────────────────────
// 전술 보정 효과 계산
// ─────────────────────────────────────────

/** 전술 설정에 따른 게임 페이즈별 보정값 계산 */
export function calculateTacticsBonus(tactics: TeamTactics): TacticsBonus {
  // 초반 전략 보정
  const earlyBonusMap: Record<EarlyStrategy, number> = {
    standard: 0,
    lane_swap: 0.02,
    invade: 0.04,
    safe_farm: -0.02,
  };

  // 중반 전략 보정
  const midBonusMap: Record<MidStrategy, number> = {
    balanced: 0,
    pick_comp: 0.03,
    split_push: 0.02,
    objective_control: 0.01,
  };

  // 후반 전략 보정
  const lateBonusMap: Record<LateStrategy, number> = {
    teamfight: 0,
    split_push: 0.02,
    siege: 0.03,
    pick: 0.03,
  };

  // 공격성 레벨에 따른 추가 보정 (5 기준, 높을수록 초반 강화 / 후반 약화)
  const aggressionOffset = (tactics.aggressionLevel - 5) * 0.005;

  // 오브젝트 우선도 보정 (드래곤 + 바론 평균)
  const objectiveBonus = ((tactics.dragonPriority + tactics.baronPriority) / 2 - 5) * 0.01;

  return {
    earlyBonus: earlyBonusMap[tactics.earlyStrategy] + aggressionOffset,
    midBonus: midBonusMap[tactics.midStrategy],
    lateBonus: lateBonusMap[tactics.lateStrategy] - aggressionOffset,
    objectiveBonus,
  };
}
