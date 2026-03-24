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

/** 시설별 레벨당 기본 효과값 (체감 가능하도록 강화) */
const BASE_EFFECT_PER_LEVEL: Record<FacilityType, number> = {
  gaming_house: 8,    // 훈련 효율 +8%/lv
  training_room: 12,  // 스탯 성장 속도 +12%/lv
  analysis_lab: 5,    // 밴픽 정확도 +5/lv
  gym: 7,             // 스태미나 회복 +7/lv
  media_room: 10,     // 팬/스폰서십 +10%/lv
  cafeteria: 5,       // 사기 보정 +5/lv
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
    // 컨디션에 따른 효과 감소 (condition 필드 없으면 100% 효율)
    const condition = (f as unknown as { condition?: number }).condition ?? 100;
    let conditionMul = 1.0;
    if (condition < 25) conditionMul = 0.5;
    else if (condition < 50) conditionMul = 0.75;

    const effectiveValue = f.effectValue * conditionMul;

    switch (f.facilityType) {
      case 'gaming_house':
        bonuses.trainingEfficiency = effectiveValue;
        break;
      case 'training_room':
        bonuses.statGrowthSpeed = effectiveValue;
        break;
      case 'analysis_lab':
        bonuses.draftAccuracy = effectiveValue;
        break;
      case 'gym':
        bonuses.staminaRecovery = effectiveValue;
        break;
      case 'media_room':
        bonuses.fanSponsorBonus = effectiveValue;
        break;
      case 'cafeteria':
        bonuses.moraleBoost = effectiveValue;
        break;
    }
  }

  return bonuses;
};

// ─────────────────────────────────────────
// 시설 노후화 & 유지보수
// ─────────────────────────────────────────

// -- MIGRATION: ALTER TABLE team_facilities ADD COLUMN condition INTEGER DEFAULT 100;

/**
 * 주간 시설 노후화 처리
 * 각 시설에 2% 확률로 컨디션 -5~-15 감소
 */
export const processFacilityDecay = async (teamId: string): Promise<string[]> => {
  const db = await getDatabase();
  const facilities = await getTeamFacilities(teamId);
  const events: string[] = [];

  for (const f of facilities) {
    if (Math.random() < 0.02) {
      const decay = 5 + Math.floor(Math.random() * 11); // 5~15
      await db.execute(
        `UPDATE team_facilities SET condition = MAX(0, COALESCE(condition, 100) - $1) WHERE team_id = $2 AND facility_type = $3`,
        [decay, teamId, f.facilityType],
      );
      events.push(`${f.facilityType} 시설 노후화 (-${decay})`);
    }
  }

  return events;
};

/**
 * 주간 시설 유지보수 비용 계산
 * 레벨당 100만 원/주
 */
export const calculateMaintenanceCost = async (teamId: string): Promise<number> => {
  const facilities = await getTeamFacilities(teamId);
  return facilities.reduce((sum, f) => sum + f.level * 100, 0);
};

/**
 * 시설 수리 (컨디션 복구)
 * 비용: (100 - 현재 컨디션) * 레벨 * 50 만 원
 */
export const repairFacility = async (
  teamId: string,
  facilityType: FacilityType,
): Promise<{ success: boolean; message: string; cost: number }> => {
  const db = await getDatabase();

  const rows = await db.select<FacilityRow[]>(
    'SELECT team_id, facility_type, level, upgrade_cost, effect_value, last_upgraded FROM team_facilities WHERE team_id = ? AND facility_type = ?',
    [teamId, facilityType],
  );
  if (rows.length === 0) return { success: false, message: '시설을 찾을 수 없습니다.', cost: 0 };

  const facility = rows[0];
  const condition = (facility as unknown as { condition?: number }).condition ?? 100;
  if (condition >= 95) return { success: false, message: '수리가 필요하지 않습니다.', cost: 0 };

  const cost = Math.round((100 - condition) * facility.level * 50);

  const teamRows = await db.select<{ budget: number }[]>('SELECT budget FROM teams WHERE id = ?', [teamId]);
  if (teamRows.length === 0 || teamRows[0].budget < cost) {
    return { success: false, message: `예산 부족 (필요: ${cost.toLocaleString()}만)`, cost };
  }

  await db.execute(
    `UPDATE team_facilities SET condition = 100 WHERE team_id = ? AND facility_type = ?`,
    [teamId, facilityType],
  );
  await db.execute('UPDATE teams SET budget = budget - ? WHERE id = ?', [cost, teamId]);

  return { success: true, message: `${facilityType} 수리 완료 (비용: ${cost.toLocaleString()}만)`, cost };
};
