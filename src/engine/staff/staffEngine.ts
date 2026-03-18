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
import type { Staff, StaffRole, StaffSpecialty } from '../../types/staff';
import type { Region } from '../../types/game';

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

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
  };
}

/** 팀당 스태프 역할별 제한 */
const STAFF_LIMITS: Record<StaffRole, number> = {
  head_coach: 1,
  coach: 2,
  analyst: 1,
  scout_manager: 1,
};

/** 팀당 총 스태프 제한 */
export const TEAM_STAFF_LIMIT = 5;

/** 팀 스태프 역할별 현황 조회 */
export function getStaffCounts(staffList: Staff[]): Record<StaffRole, number> {
  const counts: Record<StaffRole, number> = { head_coach: 0, coach: 0, analyst: 0, scout_manager: 0 };
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
  },
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
  const names = regionNames[role];
  const name = names[Math.floor(Math.random() * names.length)];
  const ability = 30 + Math.floor(Math.random() * 50); // 30~79
  const specialties: (StaffSpecialty | null)[] = ['training', 'draft', 'mentoring', 'conditioning', null];
  const specialty = role === 'head_coach' ? null : specialties[Math.floor(Math.random() * specialties.length)];
  const salary = role === 'head_coach'
    ? 1500 + Math.round(ability * 15)
    : 500 + Math.round(ability * 8);

  const result = await db.execute(
    `INSERT INTO staff (team_id, name, role, ability, specialty, salary, contract_end_season, hired_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [teamId, name, role, ability, specialty, salary, contractEndSeason, hiredDate],
  );

  return {
    id: result.lastInsertId,
    teamId, name, role, ability, specialty, salary,
    morale: 70, contractEndSeason, hiredDate,
    isFreeAgent: false,
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
}

/** 팀 스태프 보정 효과 합산 */
export async function calculateStaffBonuses(teamId: string): Promise<StaffBonuses> {
  const staff = await getTeamStaff(teamId);

  const bonuses: StaffBonuses = {
    trainingEfficiency: 1.0,
    moraleBoost: 0,
    draftAccuracy: 0,
    scoutingSpeedBonus: 0,
    scoutingAccuracyBonus: 0,
  };

  for (const s of staff) {
    const factor = s.ability / 100; // 0.0 ~ 1.0

    switch (s.role) {
      case 'head_coach':
        // 감독: 훈련 효율 +10~25%, 사기 +3~8
        bonuses.trainingEfficiency += 0.1 + factor * 0.15;
        bonuses.moraleBoost += Math.round(3 + factor * 5);
        break;
      case 'coach':
        // 코치: 훈련 효율 추가 +5~15%
        bonuses.trainingEfficiency += 0.05 + factor * 0.1;
        break;
      case 'analyst':
        // 분석관: 밴픽 정확도 +5~20
        bonuses.draftAccuracy += Math.round(5 + factor * 15);
        break;
      case 'scout_manager':
        // 스카우트 매니저: 스카우팅 속도 -1일, 정확도 +5~15
        bonuses.scoutingSpeedBonus = -1;
        bonuses.scoutingAccuracyBonus += Math.round(5 + factor * 10);
        break;
    }
  }

  return bonuses;
}
