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
  RoleInstructions,
  PatchMetaModifiers,
} from '../../types/tactics';
import type { Position } from '../../types/game';

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
  offense: number;
  defense: number;
  objective: number;
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

export function createDefaultTactics(teamId: string): TeamTactics {
  return {
    teamId,
    earlyStrategy: 'standard',
    midStrategy: 'balanced',
    lateStrategy: 'teamfight',
    wardPriority: 'balanced',
    dragonPriority: 5,
    baronPriority: 5,
    aggressionLevel: 5,
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
  const { teamId: _, ...defaults } = createDefaultTactics(teamId);
  await setTeamTactics(teamId, defaults);
}

// ─────────────────────────────────────────
// 전술 보정 효과 계산
// ─────────────────────────────────────────

/** 전술 설정에 따른 게임 페이즈별 보정값 계산 */
export function calculateTacticsBonus(tactics: TeamTactics): TacticsBonus {
  // 초반 전략 보정 (2x 강화: ±0.08 범위)
  const earlyBonusMap: Record<EarlyStrategy, number> = {
    standard: 0,
    lane_swap: 0.04,
    invade: 0.08,
    safe_farm: -0.04,
  };

  // 중반 전략 보정 (2x 강화)
  const midBonusMap: Record<MidStrategy, number> = {
    balanced: 0,
    pick_comp: 0.06,
    split_push: 0.04,
    objective_control: 0.02,
  };

  // 후반 전략 보정 (2x 강화)
  const lateBonusMap: Record<LateStrategy, number> = {
    teamfight: 0,
    split_push: 0.04,
    siege: 0.06,
    pick: 0.06,
  };

  // 공격성 레벨에 따른 추가 보정 (5 기준, 높을수록 초반 강화 / 후반 약화) (2x 강화)
  const aggressionOffset = (tactics.aggressionLevel - 5) * 0.01;

  // 오브젝트 우선도 보정 (드래곤 + 바론 평균) (2x 강화)
  const objectiveBonus = ((tactics.dragonPriority + tactics.baronPriority) / 2 - 5) * 0.02;

  return {
    earlyBonus: earlyBonusMap[tactics.earlyStrategy] + aggressionOffset,
    midBonus: midBonusMap[tactics.midStrategy],
    lateBonus: lateBonusMap[tactics.lateStrategy] - aggressionOffset,
    objectiveBonus,
    offense: Math.round((midBonusMap[tactics.midStrategy] + Math.max(aggressionOffset, 0)) * 100),
    defense: Math.round((lateBonusMap[tactics.lateStrategy] + Math.max(-aggressionOffset, 0)) * 100),
    objective: Math.round(objectiveBonus * 100),
  };
}

// ─────────────────────────────────────────
// 역할별 지시 보너스
// ─────────────────────────────────────────

export interface RoleBonus {
  position: Position;
  gankSuccessBonus: number;
  laningBonus: number;
  roamBonus: number;
  objectiveBonus: number;
}

/**
 * 역할별 지시에 따른 포지션별 보너스 계산
 * 선수 스탯과 조합하여 시너지 효과 산출
 */
export function calculateRoleBonuses(
  roleInstructions: RoleInstructions | undefined,
  playerStats: Record<Position, { aggression: number; laning: number; gameSense: number }>,
): RoleBonus[] {
  if (!roleInstructions) return [];

  const bonuses: RoleBonus[] = [];

  // 정글 지시 (2x 강화)
  const jglStats = playerStats.jungle;
  const jglInstruction = roleInstructions.jungle;
  let gankBonus = 0;
  let jglObjective = 0;
  switch (jglInstruction) {
    case 'gank_heavy':
      gankBonus = 0.10 + (jglStats.aggression - 50) * 0.002;
      break;
    case 'farm_heavy':
      gankBonus = -0.04;
      jglObjective = 0.02;
      break;
    case 'counter_jungle':
      gankBonus = 0.04;
      break;
    case 'objective_focus':
      jglObjective = 0.06;
      break;
  }
  bonuses.push({ position: 'jungle', gankSuccessBonus: gankBonus, laningBonus: 0, roamBonus: 0, objectiveBonus: jglObjective });

  // 라인 지시 (top, mid, adc)
  for (const pos of ['top', 'mid', 'adc'] as Position[]) {
    const stats = playerStats[pos];
    const instruction = roleInstructions[pos] as string;
    let laning = 0;
    let roam = 0;

    switch (instruction) {
      case 'play_safe':
        laning = 0.04 + (stats.laning - 50) * 0.001;
        break;
      case 'aggressive_trade':
        laning = (stats.aggression - 50) * 0.002;
        break;
      case 'roam':
        roam = 0.06;
        laning = -0.02;
        break;
      case 'freeze':
        laning = 0.02;
        break;
    }
    bonuses.push({ position: pos, gankSuccessBonus: 0, laningBonus: laning, roamBonus: roam, objectiveBonus: 0 });
  }

  // 서포트 지시 (2x 강화)
  const sptInstruction = roleInstructions.support;
  let sptRoam = 0;
  let sptGank = 0;
  switch (sptInstruction) {
    case 'roam_mid':
      sptRoam = 0.06;
      sptGank = 0.04;
      break;
    case 'protect_adc':
      break;
    case 'ward_deep':
      break;
    case 'engage_primary':
      sptGank = 0.04;
      break;
  }
  bonuses.push({ position: 'support', gankSuccessBonus: sptGank, laningBonus: 0, roamBonus: sptRoam, objectiveBonus: 0 });

  return bonuses;
}

// ─────────────────────────────────────────
// 전술 카운터 시스템
// ─────────────────────────────────────────

/** 전술 상성 보정: aggressive > split > controlled > aggressive (+0.03) */
type TacticsArchetype = 'aggressive' | 'split' | 'controlled';

function classifyTacticsArchetype(tactics: TeamTactics): TacticsArchetype {
  // 공격성 7 이상 또는 초반 invade → aggressive
  if (tactics.aggressionLevel >= 7 || tactics.earlyStrategy === 'invade') return 'aggressive';
  // 중/후반 split_push → split
  if (tactics.midStrategy === 'split_push' || tactics.lateStrategy === 'split_push') return 'split';
  // 나머지 (objective_control, balanced, teamfight 등) → controlled
  return 'controlled';
}

const COUNTER_MAP: Record<TacticsArchetype, TacticsArchetype> = {
  aggressive: 'split',      // aggressive beats split
  split: 'controlled',      // split beats controlled
  controlled: 'aggressive', // controlled beats aggressive
};

/**
 * 두 팀 전술 상성에 따른 보정값 계산
 * @returns 양수면 myTactics 유리, 음수면 불리, 0이면 상성 없음
 */
export function calculateCounterBonus(myTactics: TeamTactics, opponentTactics: TeamTactics): number {
  const myType = classifyTacticsArchetype(myTactics);
  const oppType = classifyTacticsArchetype(opponentTactics);

  if (myType === oppType) return 0;
  if (COUNTER_MAP[myType] === oppType) return 0.03;  // 내가 상대를 카운터
  if (COUNTER_MAP[oppType] === myType) return -0.03;  // 상대가 나를 카운터
  return 0;
}

// ─────────────────────────────────────────
// 패치 메타 보정
// ─────────────────────────────────────────

interface PatchMetaRow {
  teamfight_efficiency: number;
  split_push_efficiency: number;
  early_aggro_efficiency: number;
  objective_efficiency: number;
}

/**
 * 현재 패치 메타 보정값을 읽어 전술 보너스에 적용
 * - 패치 메타가 한타를 유리하게 하고 팀이 한타 후반 전략 사용 시 → lateBonus * 1.5
 * - 패치 메타가 스플릿을 불리하게 하고 팀이 스플릿 사용 시 → 해당 보너스 * 0.5
 * - 초반 어그로 메타 + invade/높은 공격성 → earlyBonus 증폭
 * - 오브젝트 메타 + objective_control → objectiveBonus 증폭
 */
export async function applyPatchMetaModifiers(
  bonus: TacticsBonus,
  teamTactics: TeamTactics,
): Promise<TacticsBonus> {
  const db = await getDatabase();
  let rows: PatchMetaRow[];
  try {
    rows = await db.select<PatchMetaRow[]>(
      `SELECT teamfight_efficiency, split_push_efficiency, early_aggro_efficiency, objective_efficiency
       FROM patch_meta_modifiers ORDER BY season_id DESC, patch_number DESC LIMIT 1`,
    );
  } catch {
    return bonus; // 테이블 미존재 시 보정 없이 반환
  }

  if (rows.length === 0) return bonus;

  const meta: PatchMetaModifiers = {
    teamfightEfficiency: rows[0].teamfight_efficiency,
    splitPushEfficiency: rows[0].split_push_efficiency,
    earlyAggroEfficiency: rows[0].early_aggro_efficiency,
    objectiveEfficiency: rows[0].objective_efficiency,
  };

  const result = { ...bonus };

  // 한타 메타 + 한타 후반 전략 → lateBonus 1.5배
  if (meta.teamfightEfficiency > 0 && teamTactics.lateStrategy === 'teamfight') {
    result.lateBonus *= 1.5;
  }

  // 스플릿 메타 불리 + 스플릿 전략 사용 → 해당 페이즈 보너스 50% 감소
  if (meta.splitPushEfficiency < 0) {
    if (teamTactics.midStrategy === 'split_push') {
      result.midBonus *= 0.5;
    }
    if (teamTactics.lateStrategy === 'split_push') {
      result.lateBonus *= 0.5;
    }
  }
  // 스플릿 메타 유리 + 스플릿 전략 사용 → 증폭
  if (meta.splitPushEfficiency > 0) {
    if (teamTactics.midStrategy === 'split_push') {
      result.midBonus *= 1.5;
    }
    if (teamTactics.lateStrategy === 'split_push') {
      result.lateBonus *= 1.5;
    }
  }

  // 초반 어그로 메타 + 공격적 초반 전략 → earlyBonus 증폭
  if (meta.earlyAggroEfficiency > 0 && (teamTactics.earlyStrategy === 'invade' || teamTactics.aggressionLevel >= 7)) {
    result.earlyBonus *= 1.5;
  }
  // 초반 어그로 메타 불리 + 공격적 초반 → earlyBonus 감소
  if (meta.earlyAggroEfficiency < 0 && (teamTactics.earlyStrategy === 'invade' || teamTactics.aggressionLevel >= 7)) {
    result.earlyBonus *= 0.5;
  }

  // 오브젝트 메타 + objective_control → objectiveBonus 증폭
  if (meta.objectiveEfficiency > 0 && teamTactics.midStrategy === 'objective_control') {
    result.objectiveBonus *= 1.5;
  }

  return result;
}

// ─────────────────────────────────────────
// 인게임 전술 전환
// ─────────────────────────────────────────

/**
 * 경기 중 조건 충족 시 전술 보정값 재계산
 * @returns 새로운 TacticsBonus 또는 null (전환 없음)
 */
export function checkTacticalAdjustment(
  tactics: TeamTactics,
  goldDiff: number,
  isWinningEarly: boolean,
): TacticsBonus | null {
  const adjustments = tactics.tacticalAdjustments;
  if (!adjustments || adjustments.length === 0) return null;

  for (const adj of adjustments) {
    let triggered = false;
    switch (adj.trigger) {
      case 'gold_lead_5k':
        triggered = goldDiff >= 5000;
        break;
      case 'gold_behind_5k':
        triggered = goldDiff <= -5000;
        break;
      case 'winning_early':
        triggered = isWinningEarly && goldDiff > 0;
        break;
      case 'losing_early':
        triggered = !isWinningEarly && goldDiff < 0;
        break;
      default:
        break;
    }

    if (triggered) {
      // 전술 임시 교체하여 보정값 재계산
      const adjusted: TeamTactics = {
        ...tactics,
        midStrategy: adj.switchTo.midStrategy ?? tactics.midStrategy,
        lateStrategy: adj.switchTo.lateStrategy ?? tactics.lateStrategy,
        aggressionLevel: adj.switchTo.aggressionLevel ?? tactics.aggressionLevel,
      };
      return calculateTacticsBonus(adjusted);
    }
  }

  return null;
}
