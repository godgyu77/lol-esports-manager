/**
 * 훈련 엔진
 * - 팀 훈련 스케줄 관리
 * - 선수 개별 훈련 배정
 * - 일간 훈련 효과 적용 (스탯 미세 성장 + 챔피언 숙련도)
 * - 강도에 따른 컨디션 영향
 */

import { getDatabase } from '../../db/database';
import type {
  TrainingType,
  TrainingIntensity,
  TrainableStat,
  TrainingScheduleEntry,
  PlayerTrainingAssignment,
} from '../../types/training';
import { TRAINING_STAT_MAP } from '../../types/training';
import { calculateStaffBonuses, getPhilosophyBonus, getChemistryTrainingBonus } from '../staff/staffEngine';
import { calculateFacilityBonuses } from '../facility/facilityEngine';

// ─────────────────────────────────────────
// 상수
// ─────────────────────────────────────────

/** 강도별 스탯 성장 배율 & 스태미나 소모 */
const INTENSITY_CONFIG: Record<TrainingIntensity, { statMultiplier: number; staminaCost: number; formGain: number }> = {
  light:   { statMultiplier: 0.5, staminaCost: -4,  formGain: 2 },
  normal:  { statMultiplier: 1.0, staminaCost: -8,  formGain: 5 },
  intense: { statMultiplier: 1.3, staminaCost: -15, formGain: 8 },
};

/** 기본 일간 스탯 성장량 (0.1~0.3 수준으로 미세 성장) */
const BASE_DAILY_GROWTH = 0.08;

/** SQL 컬럼명 화이트리스트 (SQL 인젝션 방지) */
const STAT_TO_COLUMN: Record<string, string> = {
  mechanical: 'mechanical',
  gameSense: 'game_sense',
  teamwork: 'teamwork',
  consistency: 'consistency',
  laning: 'laning',
  aggression: 'aggression',
};

/** 챔피언 풀 훈련 시 숙련도 상승량 */
const CHAMPION_PROFICIENCY_GAIN = 2;

// ─────────────────────────────────────────
// 훈련 스케줄 CRUD
// ─────────────────────────────────────────

export async function getTrainingSchedule(teamId: string): Promise<TrainingScheduleEntry[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    team_id: string; day_of_week: number; training_type: string; intensity: string;
  }[]>(
    'SELECT * FROM training_schedule WHERE team_id = $1 ORDER BY day_of_week',
    [teamId],
  );
  return rows.map(r => ({
    teamId: r.team_id,
    dayOfWeek: r.day_of_week,
    trainingType: r.training_type as TrainingType,
    intensity: r.intensity as TrainingIntensity,
  }));
}

export async function setTrainingSchedule(
  teamId: string,
  dayOfWeek: number,
  trainingType: TrainingType,
  intensity: TrainingIntensity,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO training_schedule (team_id, day_of_week, training_type, intensity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(team_id, day_of_week) DO UPDATE SET training_type = $3, intensity = $4`,
    [teamId, dayOfWeek, trainingType, intensity],
  );
}

/** 기본 훈련 스케줄 초기화 */
export async function initDefaultSchedule(teamId: string): Promise<void> {
  const defaults: { day: number; type: TrainingType; intensity: TrainingIntensity }[] = [
    { day: 1, type: 'laning', intensity: 'normal' },      // 월
    { day: 2, type: 'teamfight', intensity: 'normal' },   // 화
    { day: 3, type: 'general', intensity: 'normal' },     // 수
    { day: 4, type: 'macro', intensity: 'normal' },       // 목
    { day: 5, type: 'general', intensity: 'normal' },     // 금
    { day: 6, type: 'champion_pool', intensity: 'light' }, // 토
  ];

  for (const d of defaults) {
    await setTrainingSchedule(teamId, d.day, d.type, d.intensity);
  }
}

// ─────────────────────────────────────────
// 선수 개별 훈련 배정
// ─────────────────────────────────────────

export async function getPlayerTraining(teamId: string): Promise<PlayerTrainingAssignment[]> {
  const db = await getDatabase();
  const rows = await db.select<{
    player_id: string; team_id: string; training_type: string;
    target_stat: string | null; target_champion_id: string | null;
  }[]>(
    'SELECT * FROM player_training WHERE team_id = $1',
    [teamId],
  );
  return rows.map(r => ({
    playerId: r.player_id,
    teamId: r.team_id,
    trainingType: r.training_type as TrainingType,
    targetStat: r.target_stat as TrainableStat | null,
    targetChampionId: r.target_champion_id,
  }));
}

export async function setPlayerTraining(
  playerId: string,
  teamId: string,
  trainingType: TrainingType,
  targetStat?: TrainableStat,
  targetChampionId?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO player_training (player_id, team_id, training_type, target_stat, target_champion_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(player_id) DO UPDATE SET training_type = $3, target_stat = $4, target_champion_id = $5`,
    [playerId, teamId, trainingType, targetStat ?? null, targetChampionId ?? null],
  );
}

// ─────────────────────────────────────────
// 일간 훈련 효과 적용
// ─────────────────────────────────────────

export interface TrainingDayResult {
  staminaEffect: number;
  formEffect: number;
  statChanges: { playerId: string; stat: string; delta: number }[];
  championChanges: { playerId: string; championId: string; delta: number }[];
  /** 과훈련 위험 플래그된 선수 목록 */
  overtrainingRisks: { playerId: string; stamina: number; risk: 'warning' | 'critical' }[];
  /** 시설 카페테리아 사기 보너스 (적용된 값) */
  moraleBonus: number;
}

/**
 * 훈련일 효과 처리 (dayAdvancer에서 호출)
 * 팀 스케줄의 오늘 훈련 유형 + 선수별 개별 배정을 종합 적용
 */
export async function processTrainingDay(
  teamId: string,
  trainingDate: string,
  dayOfWeek: number,
): Promise<TrainingDayResult> {
  const db = await getDatabase();

  // 팀 스케줄에서 오늘의 훈련 유형/강도 조회
  const scheduleRows = await db.select<{ training_type: string; intensity: string }[]>(
    'SELECT training_type, intensity FROM training_schedule WHERE team_id = $1 AND day_of_week = $2',
    [teamId, dayOfWeek],
  );

  const teamTrainingType = (scheduleRows[0]?.training_type ?? 'general') as TrainingType;
  const intensity = (scheduleRows[0]?.intensity ?? 'normal') as TrainingIntensity;
  const config = INTENSITY_CONFIG[intensity];

  // 스태프 + 시설 + 코칭 철학 보정 적용
  let staffMultiplier = 1.0;
  let facilityMultiplier = 1.0;
  let moraleBonus = 0;
  let philosophyBonus: Awaited<ReturnType<typeof getPhilosophyBonus>> | null = null;
  try {
    const staffBonuses = await calculateStaffBonuses(teamId);
    staffMultiplier = staffBonuses.trainingEfficiency;
    const facilityBonuses = await calculateFacilityBonuses(teamId);
    facilityMultiplier = 1 + (facilityBonuses.trainingEfficiency + facilityBonuses.statGrowthSpeed) / 100;
    moraleBonus = facilityBonuses.moraleBoost; // 카페테리아 효과
    philosophyBonus = await getPhilosophyBonus(teamId);
  } catch { /* 스태프/시설 테이블 미생성 시 기본값 */ }

  // 코치-선수 케미스트리 보너스
  let chemistryBonus = 0;
  try {
    const playerNats: Record<string, string> = {};
    const playerRows = await db.select<{ id: string; nationality: string }[]>(
      'SELECT id, nationality FROM players WHERE team_id = $1', [teamId],
    );
    for (const p of playerRows) playerNats[p.id] = p.nationality;
    chemistryBonus = await getChemistryTrainingBonus(teamId, playerNats);
  } catch { /* 무시 */ }

  // 가산 방식 보너스 (+30% 상한)
  const additiveBonus = (staffMultiplier - 1) + (facilityMultiplier - 1) + chemistryBonus;
  const totalMultiplier = 1 + Math.min(0.30, Math.max(-0.15, additiveBonus));

  // 선수 개별 훈련 배정 조회
  const assignments = await getPlayerTraining(teamId);
  const assignmentMap = new Map(assignments.map(a => [a.playerId, a]));

  // 팀 선수 목록
  const players = await db.select<{
    id: string; mechanical: number; game_sense: number; teamwork: number;
    consistency: number; laning: number; aggression: number;
  }[]>(
    'SELECT id, mechanical, game_sense, teamwork, consistency, laning, aggression FROM players WHERE team_id = $1',
    [teamId],
  );

  const statChanges: { playerId: string; stat: string; delta: number }[] = [];
  const championChanges: { playerId: string; championId: string; delta: number }[] = [];
  const overtrainingRisks: { playerId: string; stamina: number; risk: 'warning' | 'critical' }[] = [];

  for (const player of players) {
    const individual = assignmentMap.get(player.id);
    // 개별 배정이 있으면 그것 우선, 없으면 팀 스케줄 따름
    const effectiveType = individual?.trainingType ?? teamTrainingType;
    const relatedStats = TRAINING_STAT_MAP[effectiveType];

    if (effectiveType === 'champion_pool') {
      // 챔피언 숙련도 향상
      const champId = individual?.targetChampionId;
      if (champId) {
        const delta = Math.round(CHAMPION_PROFICIENCY_GAIN * config.statMultiplier * totalMultiplier * 10) / 10;
        await db.execute(
          `UPDATE champion_proficiency SET proficiency = MIN(100, proficiency + $1)
           WHERE player_id = $2 AND champion_id = $3`,
          [delta, player.id, champId],
        );
        // 없으면 새로 추가
        await db.execute(
          `INSERT OR IGNORE INTO champion_proficiency (player_id, champion_id, proficiency, games_played)
           VALUES ($1, $2, $3, 0)`,
          [player.id, champId, delta],
        );
        championChanges.push({ playerId: player.id, championId: champId, delta });

        await db.execute(
          `INSERT INTO training_logs (player_id, team_id, training_date, training_type, champion_id, champion_delta)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [player.id, teamId, trainingDate, effectiveType, champId, delta],
        );
      }
    } else if (effectiveType === 'mental') {
      // 멘탈 강화 → mental 스탯 미세 상승
      const delta = Math.round(BASE_DAILY_GROWTH * config.statMultiplier * totalMultiplier * 100) / 100;
      await db.execute(
        'UPDATE players SET mental = MIN(100, mental + $1) WHERE id = $2',
        [delta, player.id],
      );
      statChanges.push({ playerId: player.id, stat: 'mental', delta });

      await db.execute(
        `INSERT INTO training_logs (player_id, team_id, training_date, training_type, stat_changed, stat_delta)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [player.id, teamId, trainingDate, effectiveType, 'mental', delta],
      );
    } else if (effectiveType === 'physical') {
      // 체력 → stamina 회복 (컨디션 시스템에서 처리하므로 여기서는 스킵)
    } else if (relatedStats.length > 0) {
      // 일반 스탯 훈련
      const targetStat = individual?.targetStat;
      const statsToTrain = targetStat ? [targetStat] : relatedStats;

      for (const stat of statsToTrain) {
        // 코칭 철학 배율 적용
        const philosophyMul = philosophyBonus?.statMultipliers[stat] ?? 1.0;
        const delta = Math.round(BASE_DAILY_GROWTH * config.statMultiplier * totalMultiplier * philosophyMul * (targetStat ? 1.5 : 1.0) * 100) / 100;

        // DB 컬럼명 매핑 (화이트리스트 검증)
        const colName = STAT_TO_COLUMN[stat];
        if (!colName) continue;
        await db.execute(
          `UPDATE players SET ${colName} = MIN(100, ${colName} + $1) WHERE id = $2`,
          [delta, player.id],
        );
        statChanges.push({ playerId: player.id, stat, delta });

        await db.execute(
          `INSERT INTO training_logs (player_id, team_id, training_date, training_type, stat_changed, stat_delta)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [player.id, teamId, trainingDate, effectiveType, stat, delta],
        );
      }
    }
  }

  // 과훈련 위험 체크: 현재 스태미나 기준 (훈련 후 예상치)
  for (const player of players) {
    // player_daily_condition에서 현재 스태미나 조회
    try {
      const condRows = await db.select<{ stamina: number }[]>(
        `SELECT stamina FROM player_daily_condition WHERE player_id = $1 ORDER BY game_date DESC LIMIT 1`,
        [player.id],
      );
      const currentStamina = condRows[0]?.stamina ?? 70;
      const estimatedStamina = currentStamina + config.staminaCost;

      if (estimatedStamina < 10) {
        overtrainingRisks.push({ playerId: player.id, stamina: estimatedStamina, risk: 'critical' });
      } else if (estimatedStamina < 20) {
        overtrainingRisks.push({ playerId: player.id, stamina: estimatedStamina, risk: 'warning' });
      }
    } catch { /* 컨디션 테이블 없으면 무시 */ }
  }

  return {
    staminaEffect: config.staminaCost,
    formEffect: config.formGain,
    statChanges,
    championChanges,
    overtrainingRisks,
    moraleBonus,
  };
}

// ─────────────────────────────────────────
// 개인 코칭 세션
// ─────────────────────────────────────────

export interface CoachingSessionResult {
  playerId: string;
  stat: string;
  delta: number;
  coachName: string;
}

/**
 * 개인 코칭 세션 (1:1 훈련)
 * 코치 능력 + 전문 분야 매칭 시 추가 보너스
 */
export async function processIndividualCoaching(
  playerId: string,
  teamId: string,
  coachId: number,
  targetStat: TrainableStat,
  trainingDate: string,
): Promise<CoachingSessionResult | null> {
  const db = await getDatabase();

  const coachRows = await db.select<{ name: string; ability: number; specialty: string | null }[]>(
    'SELECT name, ability, specialty FROM staff WHERE id = $1 AND team_id = $2',
    [coachId, teamId],
  );
  if (coachRows.length === 0) return null;

  const coach = coachRows[0];
  const baseGrowth = BASE_DAILY_GROWTH * 2; // 개인 코칭은 기본의 2배
  const coachMul = 1 + coach.ability / 100;
  const specialtyMul = coach.specialty === 'training' ? 1.2 : 1.0;
  const delta = Math.round(baseGrowth * coachMul * specialtyMul * 100) / 100;

  const colName = STAT_TO_COLUMN[targetStat];
  if (!colName) return null;
  await db.execute(
    `UPDATE players SET ${colName} = MIN(100, ${colName} + $1) WHERE id = $2`,
    [delta, playerId],
  );

  await db.execute(
    `INSERT INTO training_logs (player_id, team_id, training_date, training_type, stat_changed, stat_delta)
     VALUES ($1, $2, $3, 'individual_coaching', $4, $5)`,
    [playerId, teamId, trainingDate, targetStat, delta],
  );

  return { playerId, stat: targetStat, delta, coachName: coach.name };
}

// ─────────────────────────────────────────
// 휴식일 처리 (시설 보너스 반영)
// ─────────────────────────────────────────

export interface RestDayResult {
  staminaRecovery: number;
  moraleRecovery: number;
  facilityGymBonus: number;
  facilityCafeteriaBonus: number;
}

/**
 * 휴식일 효과 처리 — 시설 보너스 반영
 * gym: 스태미나 회복 증가, cafeteria: 사기 회복 증가
 */
export async function processRestDay(teamId: string): Promise<RestDayResult> {
  let gymBonus = 0;
  let cafeteriaBonus = 0;

  try {
    const facilityBonuses = await calculateFacilityBonuses(teamId);
    gymBonus = facilityBonuses.staminaRecovery; // gym 레벨당 +4
    cafeteriaBonus = facilityBonuses.moraleBoost; // cafeteria 레벨당 +3
  } catch { /* 시설 없으면 기본값 */ }

  return {
    staminaRecovery: 12 + gymBonus,
    moraleRecovery: 4 + cafeteriaBonus,
    facilityGymBonus: gymBonus,
    facilityCafeteriaBonus: cafeteriaBonus,
  };
}

// ─────────────────────────────────────────
// 훈련 이력 조회
// ─────────────────────────────────────────

export async function getRecentTrainingLogs(
  teamId: string,
  limit = 20,
): Promise<{ playerId: string; trainingDate: string; trainingType: string; statChanged: string | null; statDelta: number }[]> {
  const db = await getDatabase();
  return db.select(
    `SELECT player_id, training_date, training_type, stat_changed, stat_delta
     FROM training_logs WHERE team_id = $1 ORDER BY training_date DESC LIMIT $2`,
    [teamId, limit],
  ).then((rows: unknown) => (rows as { player_id: string; training_date: string; training_type: string; stat_changed: string | null; stat_delta: number }[]).map(r => ({
    playerId: r.player_id,
    trainingDate: r.training_date,
    trainingType: r.training_type,
    statChanged: r.stat_changed,
    statDelta: r.stat_delta,
  })));
}
