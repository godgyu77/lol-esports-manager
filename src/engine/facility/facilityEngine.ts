/**
 * 시설/인프라 투자 엔진
 * - 시설 조회, 초기화, 업그레이드, 보정 효과 계산
 */

import { getDatabase } from '../../db/database';
import type { FacilityType, TeamFacility } from '../../types/facility';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

const ALL_FACILITY_TYPES: FacilityType[] = [
  'gaming_house', 'training_room', 'analysis_lab', 'gym', 'media_room', 'cafeteria',
];

/** 레벨 업그레이드 비용 (만 원) — index = 현재 레벨 → 다음 레벨 비용 */
const UPGRADE_COSTS: Record<number, number> = {
  1: 5000,    // 1→2
  2: 15000,   // 2→3
  3: 30000,   // 3→4
  4: 50000,   // 4→5
};

/** 시설별 레벨당 기본 효과값 */
const BASE_EFFECT_PER_LEVEL: Record<FacilityType, number> = {
  gaming_house: 5,    // 훈련 효율 +5%/lv
  training_room: 8,   // 스탯 성장 속도 +8%/lv
  analysis_lab: 3,    // 밴픽 정확도 +3/lv
  gym: 4,             // 스태미나 회복 +4/lv
  media_room: 6,      // 팬/스폰서십 +6%/lv
  cafeteria: 3,       // 사기 보정 +3/lv
};

const MAX_LEVEL = 5;

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

interface FacilityRow {
  team_id: string;
  facility_type: string;
  level: number;
  upgrade_cost: number;
  effect_value: number;
  last_upgraded: string | null;
}

const mapRowToFacility = (row: FacilityRow): TeamFacility => ({
  teamId: row.team_id,
  facilityType: row.facility_type as FacilityType,
  level: row.level,
  upgradeCost: row.upgrade_cost,
  effectValue: row.effect_value,
  lastUpgraded: row.last_upgraded,
});

// ─────────────────────────────────────────
// 내부 유틸
// ─────────────────────────────────────────

const calcEffectValue = (type: FacilityType, level: number): number =>
  BASE_EFFECT_PER_LEVEL[type] * level;

const calcUpgradeCost = (level: number): number =>
  level >= MAX_LEVEL ? 0 : (UPGRADE_COSTS[level] ?? 0);

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/** 팀 시설 전체 조회 */
export const getTeamFacilities = async (teamId: string): Promise<TeamFacility[]> => {
  const db = await getDatabase();
  const rows = await db.select<FacilityRow[]>(
    'SELECT team_id, facility_type, level, upgrade_cost, effect_value, last_upgraded FROM team_facilities WHERE team_id = ?',
    [teamId],
  );
  return rows.map(mapRowToFacility);
};

/** 기본 시설 초기화 (모두 레벨 1) */
export const initDefaultFacilities = async (teamId: string): Promise<void> => {
  const db = await getDatabase();

  for (const type of ALL_FACILITY_TYPES) {
    const effectValue = calcEffectValue(type, 1);
    const upgradeCost = calcUpgradeCost(1);

    await db.execute(
      `INSERT OR IGNORE INTO team_facilities (team_id, facility_type, level, upgrade_cost, effect_value)
       VALUES (?, ?, 1, ?, ?)`,
      [teamId, type, upgradeCost, effectValue],
    );
  }
};

/** 시설 업그레이드 — 예산 차감 포함 */
export const upgradeFacility = async (
  teamId: string,
  facilityType: FacilityType,
  currentDate: string,
): Promise<{ success: boolean; message: string }> => {
  const db = await getDatabase();

  // 현재 시설 조회
  const rows = await db.select<FacilityRow[]>(
    'SELECT team_id, facility_type, level, upgrade_cost, effect_value, last_upgraded FROM team_facilities WHERE team_id = ? AND facility_type = ?',
    [teamId, facilityType],
  );

  if (rows.length === 0) {
    return { success: false, message: '시설을 찾을 수 없습니다.' };
  }

  const facility = rows[0];

  if (facility.level >= MAX_LEVEL) {
    return { success: false, message: '이미 최대 레벨입니다.' };
  }

  const cost = calcUpgradeCost(facility.level);

  // 예산 확인
  const teamRows = await db.select<{ budget: number }[]>(
    'SELECT budget FROM teams WHERE id = ?',
    [teamId],
  );
  if (teamRows.length === 0) {
    return { success: false, message: '팀을 찾을 수 없습니다.' };
  }

  const currentBudget = teamRows[0].budget;
  if (currentBudget < cost) {
    return { success: false, message: `예산이 부족합니다. (필요: ${cost.toLocaleString()}만 / 보유: ${currentBudget.toLocaleString()}만)` };
  }

  const newLevel = facility.level + 1;
  const newEffectValue = calcEffectValue(facilityType, newLevel);
  const newUpgradeCost = calcUpgradeCost(newLevel);

  // 트랜잭션: 시설 업그레이드 + 예산 차감 + 이력 기록
  await db.execute(
    `UPDATE team_facilities SET level = ?, upgrade_cost = ?, effect_value = ?, last_upgraded = ? WHERE team_id = ? AND facility_type = ?`,
    [newLevel, newUpgradeCost, newEffectValue, currentDate, teamId, facilityType],
  );

  await db.execute(
    `UPDATE teams SET budget = budget - ? WHERE id = ?`,
    [cost, teamId],
  );

  await db.execute(
    `INSERT INTO facility_upgrades (team_id, facility_type, from_level, to_level, cost, upgrade_date) VALUES (?, ?, ?, ?, ?, ?)`,
    [teamId, facilityType, facility.level, newLevel, cost, currentDate],
  );

  return { success: true, message: `${facilityType} 레벨 ${newLevel}로 업그레이드 완료! (비용: ${cost.toLocaleString()}만 원)` };
};

/** 시설 보정 효과 합산 */
export interface FacilityBonuses {
  trainingEfficiency: number;   // gaming_house 효과 (%)
  statGrowthSpeed: number;      // training_room 효과 (%)
  draftAccuracy: number;        // analysis_lab 효과
  staminaRecovery: number;      // gym 효과
  fanSponsorBonus: number;      // media_room 효과 (%)
  moraleBoost: number;          // cafeteria 효과
}

export const calculateFacilityBonuses = async (teamId: string): Promise<FacilityBonuses> => {
  const facilities = await getTeamFacilities(teamId);

  const bonuses: FacilityBonuses = {
    trainingEfficiency: 0,
    statGrowthSpeed: 0,
    draftAccuracy: 0,
    staminaRecovery: 0,
    fanSponsorBonus: 0,
    moraleBoost: 0,
  };

  for (const f of facilities) {
    switch (f.facilityType) {
      case 'gaming_house':
        bonuses.trainingEfficiency = f.effectValue;
        break;
      case 'training_room':
        bonuses.statGrowthSpeed = f.effectValue;
        break;
      case 'analysis_lab':
        bonuses.draftAccuracy = f.effectValue;
        break;
      case 'gym':
        bonuses.staminaRecovery = f.effectValue;
        break;
      case 'media_room':
        bonuses.fanSponsorBonus = f.effectValue;
        break;
      case 'cafeteria':
        bonuses.moraleBoost = f.effectValue;
        break;
    }
  }

  return bonuses;
};
