/**
 * 구단주 교체 시스템
 * - 팀 티어 기반 구단주 생성
 * - 시즌 종료 시 만족도 기반 교체 가능성
 * - 구단주 이름 풀 (한국/중국/유럽/미국)
 */

import { getDatabase } from '../../db/database';
import { nextRandom, pickRandom, randomInt } from '../../utils/random';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type InvestmentLevel = 'low' | 'moderate' | 'high' | 'sugar_daddy';

export interface ClubOwner {
  id: number;
  teamId: string;
  ownerName: string;
  investmentLevel: InvestmentLevel;
  patience: number;
  ambition: number;
  isActive: boolean;
  startDate: string;
}

interface OwnerRow {
  id: number;
  team_id: string;
  owner_name: string;
  investment_level: string;
  patience: number;
  ambition: number;
  is_active: number;
  start_date: string;
}

function mapRow(row: OwnerRow): ClubOwner {
  return {
    id: row.id,
    teamId: row.team_id,
    ownerName: row.owner_name,
    investmentLevel: row.investment_level as InvestmentLevel,
    patience: row.patience,
    ambition: row.ambition,
    isActive: Boolean(row.is_active),
    startDate: row.start_date,
  };
}

// ─────────────────────────────────────────
// 구단주 이름 풀
// ─────────────────────────────────────────

const OWNER_NAMES: Record<string, string[]> = {
  korean: [
    '김성호', '이재현', '박민수', '최영진', '정대웅',
    '윤상혁', '장기석', '한태준', '오승환', '임도현',
    '서진우', '노광현', '조민기', '송태현', '강석진',
  ],
  chinese: [
    '王建明', '李志强', '张伟华', '刘天宝', '陈国栋',
    '杨明辉', '黄志远', '周鹏飞', '吴家豪', '林宝华',
    '马云翔', '赵天成', '孙浩然', '郑大海', '钱锦程',
  ],
  european: [
    'Hans Müller', 'Pierre Dupont', 'Carlos García', 'Giovanni Rossi', 'James Wilson',
    'Erik Johansson', 'Stefan Schneider', 'François Martin', 'Andrei Petrov', 'Luca Bianchi',
    'Robert van der Berg', 'Henrik Larsson', 'Miguel Torres', 'Olivier Bernard', 'Pavel Novák',
  ],
  american: [
    'David Thompson', 'Michael Roberts', 'Robert Chen', 'Steve Park', 'Andrew Kim',
    'Jason Lee', 'Chris Martinez', 'Kevin O\'Brien', 'Brian Johnson', 'Mark Williams',
    'Ryan Mitchell', 'Tyler Anderson', 'Brandon Lee', 'Patrick Sullivan', 'Derek Wang',
  ],
};

/** 랜덤 구단주 이름 생성 */
function randomOwnerName(): string {
  const pools = Object.values(OWNER_NAMES);
  const pool = pickRandom(pools);
  return pickRandom(pool);
}

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 재정 티어 기반 구단주 생성
 * S → sugar_daddy, A → high, B → moderate, C → low
 */
export async function initOwnership(
  teamId: string,
  tier: string,
  date: string,
): Promise<ClubOwner> {
  const investmentLevel: InvestmentLevel =
    tier === 'S' ? 'sugar_daddy'
    : tier === 'A' ? 'high'
    : tier === 'B' ? 'moderate'
    : 'low';

  const patience = investmentLevel === 'sugar_daddy' ? randomInt(6, 9)
    : investmentLevel === 'high' ? randomInt(4, 7)
    : investmentLevel === 'moderate' ? randomInt(3, 6)
    : randomInt(2, 5);

  const ambition = investmentLevel === 'sugar_daddy' ? randomInt(7, 10)
    : investmentLevel === 'high' ? randomInt(6, 9)
    : investmentLevel === 'moderate' ? randomInt(4, 7)
    : randomInt(2, 5);

  const ownerName = randomOwnerName();

  const db = await getDatabase();
  const result = await db.execute(
    `INSERT INTO club_ownership (team_id, owner_name, investment_level, patience, ambition, is_active, start_date)
     VALUES ($1, $2, $3, $4, $5, 1, $6)`,
    [teamId, ownerName, investmentLevel, patience, ambition, date],
  );

  return {
    id: result.lastInsertId as number,
    teamId,
    ownerName,
    investmentLevel,
    patience,
    ambition,
    isActive: true,
    startDate: date,
  };
}

/**
 * 시즌 종료 시 구단주 교체 체크
 * - 만족도 15 이하 + 2시즌 연속 → 20% 교체 확률
 * - 교체 시: 새 구단주 랜덤 생성, 기대치 리셋, 예산 변동
 */
export async function checkOwnershipChange(
  teamId: string,
  seasonId: number,
  boardSatisfaction: number,
): Promise<{ changed: boolean; newOwner?: ClubOwner; message: string }> {
  const db = await getDatabase();
  const currentOwner = await getCurrentOwner(teamId);

  if (!currentOwner) {
    return { changed: false, message: '현재 구단주가 없습니다.' };
  }

  // 만족도 체크
  if (boardSatisfaction > 15) {
    return { changed: false, message: '구단주가 현 상황에 만족합니다.' };
  }

  // 2시즌 연속 저조한 성적 체크 (이전 시즌의 board_expectations 조회)
  const prevRows = await db.select<{ satisfaction: number }[]>(
    `SELECT satisfaction FROM board_expectations
     WHERE team_id = $1 AND season_id < $2
     ORDER BY season_id DESC LIMIT 1`,
    [teamId, seasonId],
  );

  const prevSatisfaction = prevRows.length > 0 ? prevRows[0].satisfaction : 50;

  if (prevSatisfaction > 15) {
    return { changed: false, message: '2시즌 연속 조건 미충족.' };
  }

  // 20% 확률로 교체
  if (nextRandom() > 0.20) {
    return { changed: false, message: '구단주가 한 번 더 기회를 줍니다.' };
  }

  // 기존 구단주 비활성화
  await db.execute(
    'UPDATE club_ownership SET is_active = 0 WHERE team_id = $1 AND is_active = 1',
    [teamId],
  );

  // 새 구단주 생성
  const newInvestment = ['low', 'moderate', 'high', 'sugar_daddy'][randomInt(0, 3)] as InvestmentLevel;
  const newOwnerName = randomOwnerName();
  const patience = randomInt(3, 8);
  const ambition = randomInt(3, 8);

  const result = await db.execute(
    `INSERT INTO club_ownership (team_id, owner_name, investment_level, patience, ambition, is_active, start_date)
     VALUES ($1, $2, $3, $4, $5, 1, $6)`,
    [teamId, newOwnerName, newInvestment, patience, ambition, new Date().toISOString().slice(0, 10)],
  );

  // 예산 변동 적용
  const budgetMultiplier =
    newInvestment === 'sugar_daddy' ? 1.5
    : newInvestment === 'high' ? 1.2
    : newInvestment === 'moderate' ? 1.0
    : 0.8;

  await db.execute(
    'UPDATE teams SET budget = CAST(budget * $1 AS INTEGER) WHERE id = $2',
    [budgetMultiplier, teamId],
  );

  // 기대치 리셋 (다음 시즌에 새로 설정됨)
  await db.execute(
    'UPDATE board_expectations SET satisfaction = 50, warning_count = 0 WHERE team_id = $1 AND season_id = $2',
    [teamId, seasonId],
  );

  const newOwner: ClubOwner = {
    id: result.lastInsertId as number,
    teamId,
    ownerName: newOwnerName,
    investmentLevel: newInvestment,
    patience,
    ambition,
    isActive: true,
    startDate: new Date().toISOString().slice(0, 10),
  };

  return {
    changed: true,
    newOwner,
    message: `구단주가 교체되었습니다! ${newOwnerName} (투자: ${newInvestment})`,
  };
}

/**
 * 현재 활성 구단주 조회
 */
export async function getCurrentOwner(teamId: string): Promise<ClubOwner | null> {
  const db = await getDatabase();
  const rows = await db.select<OwnerRow[]>(
    'SELECT * FROM club_ownership WHERE team_id = $1 AND is_active = 1 ORDER BY id DESC LIMIT 1',
    [teamId],
  );
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}
