/**
 * 스태프 엔진
 * - 스태프 고용/해고/조회
 * - 스태프 능력에 따른 게임 보정 효과 계산
 * - 감독: 훈련 효율 + 사기 보정
 * - 코치: 특정 훈련 효율 추가 보정
 * - 분석관: 밴픽 추천 정확도 보정
 * - 스카우트 매니저: 스카우팅 속도/정확도 보정
 */

import { getDatabase } from '../../db/database';
import type { Staff, StaffRole, StaffSpecialty, CoachingPhilosophy } from '../../types/staff';
import type { Region } from '../../types/game';
import { pickRandom, randomInt } from '../../utils/random';

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

// -- MIGRATION: ALTER TABLE staff ADD COLUMN philosophy TEXT DEFAULT NULL;
// -- MIGRATION: ALTER TABLE staff ADD COLUMN nationality TEXT DEFAULT NULL;

interface StaffRow {
  id: number;
  team_id: string | null;
  name: string;
  role: string;
  ability: number;
  specialty: string | null;
  salary: number;
  morale: number;
  contract_end_season: number;
  hired_date: string;
  is_free_agent: number;
  philosophy: string | null;
  nationality: string | null;
}

function mapRowToStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    role: row.role as StaffRole,
    ability: row.ability,
    specialty: row.specialty as StaffSpecialty | null,
    salary: row.salary,
    morale: row.morale,
    contractEndSeason: row.contract_end_season,
    hiredDate: row.hired_date,
    isFreeAgent: row.is_free_agent === 1,
    philosophy: (row.philosophy as CoachingPhilosophy) ?? null,
    nationality: row.nationality ?? null,
  };
}

/** 팀당 스태프 역할별 제한 */
const STAFF_LIMITS: Record<StaffRole, number> = {
  head_coach: 1,
  coach: 2,
  analyst: 1,
  scout_manager: 1,
  sports_psychologist: 1,
  nutritionist: 1,
  physiotherapist: 1,
  data_analyst: 1,
};

/** 팀당 총 스태프 제한 */
export const TEAM_STAFF_LIMIT = 9;

/** 팀 스태프 역할별 현황 조회 */
export function getStaffCounts(staffList: Staff[]): Record<StaffRole, number> {
  const counts: Record<StaffRole, number> = {
    head_coach: 0, coach: 0, analyst: 0, scout_manager: 0,
    sports_psychologist: 0, nutritionist: 0, physiotherapist: 0, data_analyst: 0,
  };
  for (const s of staffList) {
    counts[s.role]++;
  }
  return counts;
}

/** 특정 역할을 더 고용할 수 있는지 확인 */
export function canHireRole(staffList: Staff[], role: StaffRole): boolean {
  const counts = getStaffCounts(staffList);
  return counts[role] < STAFF_LIMITS[role] && staffList.length < TEAM_STAFF_LIMIT;
}

// ─────────────────────────────────────────
// 리전별 스태프 이름 풀
// ─────────────────────────────────────────

/**
 * 2026 시즌 확정 기준 리전별 스태프 이름 풀
 * 실제 팀 감독/코치 데이터를 반영
 */
const STAFF_NAMES_BY_REGION: Record<Region, Record<StaffRole, string[]>> = {
  LCK: {
    head_coach: [
      '김정균 (kkOma)',      // T1 감독
      '류상욱 (Ryu)',        // Gen.G 감독
      '윤성영 (Homme)',      // HLE 감독
      '김대호 (cvMax)',      // DK 감독
      '고동빈 (Score)',      // KT 감독
      '주영달',              // DN SOOPers 감독
      '최인규',              // NS 감독
      '김상수 (SSONG)',      // BRION 감독
      '박준석 (Edo)',        // BNK FearX 감독
      '조재읍 (Joker)',      // DRX 감독
    ],
    coach: [
      '이재하 (Mowgli)',     // HLE 코치
      '연형모 (Shin)',       // HLE 코치
      '김다빈 (Lyn)',        // Gen.G 코치
      '박찬호 (Nova)',       // Gen.G 코치
      '김윤수', '이성진', '정성민', '조규남',
    ],
    analyst: ['김태현', '이동현', '박준서', '최우석', '홍승우', '한승엽', '이재민'],
    scout_manager: ['서민석', '강동욱', '남궁민', '장현우', '류재현'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
  LPL: {
    head_coach: [
      '양대인 (Daeny)',      // BLG 감독
      '严强 (Tabe)',         // JDG 감독
      '장포호 (Poppy)',      // TES 감독 (前 RNG/EDG)
      '증신이 (Maizijian)',  // NIP 감독
      '권영재 (Helper)',     // AL 감독
      '강천 (Teacherma)',    // AL 코치 (前 WE 감독)
    ],
    coach: [
      '陈伟 (Chen)', '王磊 (Wang)', '李浩 (Li)', '张凯 (Zhang)', '赵鹏 (Zhao)',
      '周明 (Zhou)', '黄强 (Huang)',
    ],
    analyst: ['Liu Wei', 'Yang Hao', 'Wu Chen', 'Xu Ming', 'Gao Lei', 'Jiang Tao'],
    scout_manager: ['Zhao Feng', 'Lin Jie', 'Sun Tao', 'Ma Jun', 'He Yi'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
  LEC: {
    head_coach: [
      'Dylan Falco',          // G2 감독
      'Yanis Kella (Striker)', // FNC 감독
      'André Guilhoto',       // GX 감독
      '복한규 (Reapered)',    // KC 감독
      'Rehareha Ramanana (Reha)', // Shifters 감독
      'Tomás Fernández (Melzhet)', // VIT 감독
      'Vasilis Voltis (TheRock)', // TH 감독
      'Simon Payne (fredy122)', // KOI 감독
      'David Rodriguez (Own3r)', // SK 감독
      'Patrick Suckow-Breum (Pad)', // NAVI 감독
    ],
    coach: [
      'Peter Dun', 'Tore', 'Jesiz', 'Mikael (Hiiva)',
      'Lucas', 'Markus', 'Nikolaj',
    ],
    analyst: ['Thomas', 'Marcus', 'Erik', 'Luka', 'Andreas', 'Fabian', 'Ianis (Blidzy)'],
    scout_manager: ['Stefan', 'François', 'Björn', 'Henrik', 'Carlos'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
  LCS: {
    head_coach: [
      'Jake Tiberi (Spawn)',    // TL 감독
      'Thinkcard',              // FLY 감독
      'Goldenglue',             // SEN 감독
      'Simon Papamarkos (Swiffer)', // DIG 감독 (前 TL)
      '복한규 (Reapered)',      // 前 LCS 감독 (현 KC)
      'Nick (Inero)',           // 前 LCS 감독
    ],
    coach: [
      'Mark (MarkZ)', 'David Lim', 'Pr0lly', 'Amazing',
      'Brendan (Bubbadub)', 'Tyler (Thien)',
    ],
    analyst: ['Kevin', 'Brian', 'James', 'David', 'Michael', 'Chris'],
    scout_manager: ['Jason', 'Andrew', 'Ryan', 'Daniel', 'Matt'],
    sports_psychologist: [],
    nutritionist: [],
    physiotherapist: [],
    data_analyst: [],
  },
};

/** 전문 스태프 이름 풀 (리전 공통) */
const SPECIALIST_NAMES: Partial<Record<StaffRole, string[]>> = {
  sports_psychologist: [
    '김서윤 (심리상담)', '박민지 (스포츠심리)', '이하은 (정신건강)', '최유진 (멘탈코치)',
    'Dr. Sarah Chen', 'Dr. Marcus Weber', '장은비 (마인드코치)', 'Dr. Emily Park',
  ],
  nutritionist: [
    '정아름 (스포츠영양)', '한소희 (영양관리)', '이수정 (식단설계)', '박지영 (체력영양)',
    'James Kim (Nutrition)', 'Dr. Min-ho Lee', '오세영 (건강관리)', 'Rachel Choi',
  ],
  physiotherapist: [
    '김태훈 (물리치료)', '이준혁 (재활전문)', '박성호 (스포츠재활)', '최동현 (근골격)',
    'Dr. David Yoon', 'Alex Park (PT)', '남궁현 (물리재활)', 'Chris Kang (Sports PT)',
  ],
  data_analyst: [
    '임지훈 (데이터)', '강민수 (전술분석)', '서현우 (통계)', '조영호 (AI분석)',
    'Kevin Liu (Data)', 'Michael Cho (Analytics)', '윤석현 (메타분석)', 'Jason Han (Stats)',
  ],
};

// ─────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────

export async function getTeamStaff(teamId: string): Promise<Staff[]> {
  const db = await getDatabase();
  const rows = await db.select<StaffRow[]>(
    'SELECT * FROM staff WHERE team_id = $1 ORDER BY role, ability DESC',
    [teamId],
  );
  return rows.map(mapRowToStaff);
}

export async function hireStaff(
  teamId: string,
  role: StaffRole,
  contractEndSeason: number,
  hiredDate: string,
): Promise<Staff> {
  const db = await getDatabase();

  // 팀의 리전 조회
  const teamRows = await db.select<{ region: string }[]>(
    'SELECT region FROM teams WHERE id = $1',
    [teamId],
  );
  const region = (teamRows[0]?.region ?? 'LCK') as Region;

  // 리전별 이름 풀 선택
  const regionNames = STAFF_NAMES_BY_REGION[region] ?? STAFF_NAMES_BY_REGION['LCK'];
  const names = regionNames[role] ?? SPECIALIST_NAMES[role] ?? ['전문가'];
  const name = pickRandom(names);
  const ability = randomInt(30, 79); // 30~79
  const specialties: (StaffSpecialty | null)[] = ['training', 'draft', 'mentoring', 'conditioning', null];
  const specialty = role === 'head_coach' ? null : pickRandom(specialties);
  const salary = role === 'head_coach'
    ? 1500 + Math.round(ability * 15)
    : 500 + Math.round(ability * 8);

  // 감독만 코칭 철학 배정
  const philosophies: CoachingPhilosophy[] = ['aggressive', 'defensive', 'balanced', 'developmental'];
  const philosophy = role === 'head_coach'
    ? pickRandom(philosophies)
    : null;

  // 리전별 국적 매핑
  const REGION_TO_NATIONALITY: Record<string, string> = { LCK: 'KR', LPL: 'CN', LEC: 'EU', LCS: 'NA' };
  const nationality = REGION_TO_NATIONALITY[region] ?? 'KR';

  const result = await db.execute(
    `INSERT INTO staff (team_id, name, role, ability, specialty, salary, contract_end_season, hired_date, philosophy, nationality)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [teamId, name, role, ability, specialty, salary, contractEndSeason, hiredDate, philosophy, nationality],
  );

  return {
    id: result.lastInsertId ?? 0,
    teamId, name, role, ability, specialty, salary,
    morale: 70, contractEndSeason, hiredDate,
    isFreeAgent: false, philosophy, nationality,
  };
}

/** 스태프 해고 → FA 전환 (DELETE 대신 team_id = NULL, is_free_agent = 1) */
export async function fireStaff(staffId: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE staff SET team_id = NULL, is_free_agent = 1 WHERE id = $1',
    [staffId],
  );
}

/** FA 스태프 목록 조회 */
export async function getFreeAgentStaff(): Promise<Staff[]> {
  const db = await getDatabase();
  const rows = await db.select<StaffRow[]>(
    'SELECT * FROM staff WHERE is_free_agent = 1 ORDER BY ability DESC',
  );
  return rows.map(mapRowToStaff);
}

/** FA 스태프를 팀에 영입 */
export async function hireExistingStaff(
  staffId: number,
  teamId: string,
  contractEndSeason: number,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE staff SET team_id = $1, is_free_agent = 0, contract_end_season = $2 WHERE id = $3',
    [teamId, contractEndSeason, staffId],
  );
}

// ─────────────────────────────────────────
// 보정 효과 계산
// ─────────────────────────────────────────

export interface StaffBonuses {
  trainingEfficiency: number;     // 훈련 효율 배율 (1.0 = 기본)
  moraleBoost: number;            // 사기 보정 (0~+10)
  draftAccuracy: number;          // 밴픽 정확도 보정 (0~+20)
  scoutingSpeedBonus: number;     // 스카우팅 속도 보너스 일수 (-1~0)
  scoutingAccuracyBonus: number;  // 스카우팅 정확도 보너스 (0~+15)
  // 전문 스태프 보너스
  moraleRecoveryBonus: number;    // 일일 사기 회복 추가량 (0~+3)
  pressureResistanceBonus: number; // 압박 저항력 보정 (0~+0.1)
  staminaRecoveryBonus: number;   // 스태미나 회복 보정 배율 (1.0 = 기본)
  injuryPreventionBonus: number;  // 부상 확률 감소율 (0~-0.3 = 30% 감소)
  injuryRecoveryBonus: number;    // 부상 회복 가속 (0~-0.2 = 20% 빠른 회복)
  reinjuryPreventionBonus: number; // 재부상 방지율 (0~-0.5)
  opponentAnalysisBonus: number;  // 상대 분석 정확도 (0~+20)
  metaAdaptationBonus: number;    // 메타 적응 가속 일수 (0~-3)
}

/** 스태프 사기에 따른 효율 계수 (0.7 ~ 1.3) */
function getMoraleFactor(morale: number): number {
  return 0.7 + (morale / 100) * 0.6;
}

/** 팀 스태프 보정 효과 합산 (사기 반영) */
export async function calculateStaffBonuses(teamId: string): Promise<StaffBonuses> {
  const staff = await getTeamStaff(teamId);

  const bonuses: StaffBonuses = {
    trainingEfficiency: 1.0,
    moraleBoost: 0,
    draftAccuracy: 0,
    scoutingSpeedBonus: 0,
    scoutingAccuracyBonus: 0,
    moraleRecoveryBonus: 0,
    pressureResistanceBonus: 0,
    staminaRecoveryBonus: 1.0,
    injuryPreventionBonus: 0,
    injuryRecoveryBonus: 0,
    reinjuryPreventionBonus: 0,
    opponentAnalysisBonus: 0,
    metaAdaptationBonus: 0,
  };

  for (const s of staff) {
    const factor = s.ability / 100; // 0.0 ~ 1.0
    const moraleFactor = getMoraleFactor(s.morale);

    switch (s.role) {
      case 'head_coach':
        bonuses.trainingEfficiency += (0.1 + factor * 0.15) * moraleFactor;
        bonuses.moraleBoost += Math.round((3 + factor * 5) * moraleFactor);
        break;
      case 'coach':
        bonuses.trainingEfficiency += (0.05 + factor * 0.1) * moraleFactor;
        break;
      case 'analyst':
        bonuses.draftAccuracy += Math.round((5 + factor * 15) * moraleFactor);
        break;
      case 'scout_manager':
        bonuses.scoutingSpeedBonus = -1;
        bonuses.scoutingAccuracyBonus += Math.round((5 + factor * 10) * moraleFactor);
        break;
      case 'sports_psychologist':
        // 사기 회복 가속 + 압박 저항력 향상
        bonuses.moraleRecoveryBonus += Math.round((1 + factor * 2) * moraleFactor);
        bonuses.pressureResistanceBonus += (0.03 + factor * 0.07) * moraleFactor;
        break;
      case 'nutritionist':
        // 스태미나 회복 가속 + 부상 예방
        bonuses.staminaRecoveryBonus += (0.1 + factor * 0.15) * moraleFactor;
        bonuses.injuryPreventionBonus -= (0.1 + factor * 0.2) * moraleFactor; // 음수 = 부상 확률 감소
        break;
      case 'physiotherapist':
        // 부상 회복 가속 + 재부상 방지
        bonuses.injuryRecoveryBonus -= (0.05 + factor * 0.15) * moraleFactor; // 음수 = 회복 빠름
        bonuses.reinjuryPreventionBonus -= (0.1 + factor * 0.4) * moraleFactor; // 음수 = 재부상 감소
        break;
      case 'data_analyst':
        // 상대 분석 + 메타 적응
        bonuses.opponentAnalysisBonus += Math.round((5 + factor * 15) * moraleFactor);
        bonuses.metaAdaptationBonus -= Math.round((1 + factor * 2) * moraleFactor); // 음수 = 적응 빠름
        break;
    }
  }

  return bonuses;
}

// ─────────────────────────────────────────
// 스태프 사기 시스템
// ─────────────────────────────────────────

/** 스태프 사기 변경 */
export async function updateStaffMorale(staffId: number, delta: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE staff SET morale = MAX(0, MIN(100, morale + $1)) WHERE id = $2`,
    [delta, staffId],
  );
}

/** 팀 전체 스태프 사기 일괄 변경 (승리/패배 시) */
export async function updateTeamStaffMorale(teamId: string, delta: number): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE staff SET morale = MAX(0, MIN(100, morale + $1)) WHERE team_id = $2`,
    [delta, teamId],
  );
}

/** 주간 스태프 사기 자연 회복 (70 방향으로 수렴) */
export async function weeklyStaffMoraleRecovery(teamId: string): Promise<void> {
  const db = await getDatabase();
  // 70 이하이면 +2, 70 초과이면 -1 (자연 수렴)
  await db.execute(
    `UPDATE staff SET morale = CASE
       WHEN morale < 70 THEN MIN(70, morale + 2)
       WHEN morale > 70 THEN MAX(70, morale - 1)
       ELSE morale
     END
     WHERE team_id = $1`,
    [teamId],
  );
}

// ─────────────────────────────────────────
// 코칭 철학 효과
// ─────────────────────────────────────────

export interface PhilosophyBonus {
  /** 스탯별 훈련 배율 조정 */
  statMultipliers: Record<string, number>;
  /** 젊은 선수 성장 배율 */
  youngPlayerGrowth: number;
}

/** 감독 코칭 철학에 따른 훈련 보정 */
export async function getPhilosophyBonus(teamId: string): Promise<PhilosophyBonus> {
  const staff = await getTeamStaff(teamId);
  const headCoach = staff.find(s => s.role === 'head_coach');
  const philosophy = headCoach?.philosophy ?? 'balanced';

  const base: PhilosophyBonus = {
    statMultipliers: {
      mechanical: 1.0, gameSense: 1.0, teamwork: 1.0,
      consistency: 1.0, laning: 1.0, aggression: 1.0,
    },
    youngPlayerGrowth: 1.0,
  };

  switch (philosophy) {
    case 'aggressive':
      base.statMultipliers.aggression = 1.15;
      base.statMultipliers.teamwork = 0.95;
      break;
    case 'defensive':
      base.statMultipliers.gameSense = 1.15;
      base.statMultipliers.aggression = 0.95;
      break;
    case 'developmental':
      base.youngPlayerGrowth = 1.20;
      break;
    case 'balanced':
    default:
      break;
  }

  return base;
}

// ─────────────────────────────────────────
// 코치-선수 케미스트리
// ─────────────────────────────────────────

/**
 * 코치-선수 간 케미스트리 점수 (0~100)
 * 같은 국적: +10, 전문 분야 매칭: +15
 */
export function calculateCoachPlayerChemistry(
  coach: Staff,
  playerNationality: string,
): number {
  let chemistry = 50; // 기본 50

  // 국적 보너스
  if (coach.nationality === playerNationality) chemistry += 10;

  // 전문 분야 보너스
  if (coach.specialty === 'training') chemistry += 15;
  if (coach.specialty === 'mentoring') chemistry += 10;
  if (coach.specialty === 'conditioning') chemistry += 5;

  return Math.min(100, chemistry);
}

/** 팀 평균 코치-선수 케미스트리 → 훈련 보너스 (최대 +5%) */
export async function getChemistryTrainingBonus(
  teamId: string,
  playerNationalities: Record<string, string>,
): Promise<number> {
  const staff = await getTeamStaff(teamId);
  const coaches = staff.filter(s => s.role === 'head_coach' || s.role === 'coach');
  if (coaches.length === 0) return 0;

  const playerIds = Object.keys(playerNationalities);
  if (playerIds.length === 0) return 0;

  let totalChemistry = 0;
  let count = 0;

  for (const coach of coaches) {
    for (const playerId of playerIds) {
      totalChemistry += calculateCoachPlayerChemistry(coach, playerNationalities[playerId]);
      count++;
    }
  }

  const avgChemistry = totalChemistry / count;
  // 0~100 → 0~0.05 (최대 +5%)
  return (avgChemistry - 50) / 50 * 0.05;
}
