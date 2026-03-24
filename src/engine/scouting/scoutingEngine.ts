/**
 * 스카우팅 엔진
 * - 스카우트 고용/해고
 * - 스카우팅 배정 및 리포트 생성
 * - 정확도 계산 (스카우트 능력 + 리전 특화)
 * - 일간 진행 시 리포트 진행도 업데이트
 */

import { getDatabase } from '../../db/database';
import type { Player } from '../../types/player';
import type { Region } from '../../types/game';
import type { Scout, ScoutingReport } from '../../types/scout';
import { calculateStaffBonuses } from '../staff/staffEngine';

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

interface ScoutRow {
  id: number;
  team_id: string;
  name: string;
  ability: number;
  experience: number;
  region_specialty: string | null;
  salary: number;
  hired_date: string;
}

interface ReportRow {
  id: number;
  scout_id: number;
  player_id: string;
  team_id: string;
  accuracy: number;
  reported_mechanical: number | null;
  reported_game_sense: number | null;
  reported_teamwork: number | null;
  reported_consistency: number | null;
  reported_laning: number | null;
  reported_aggression: number | null;
  reported_potential: number | null;
  reported_mental: number | null;
  overall_grade: string;
  scout_comment: string | null;
  report_date: string;
  is_completed: number;
  days_remaining: number;
}

function mapRowToScout(row: ScoutRow): Scout {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    ability: row.ability,
    experience: row.experience,
    regionSpecialty: (row.region_specialty as Region) ?? null,
    salary: row.salary,
    hiredDate: row.hired_date,
  };
}

function mapRowToReport(row: ReportRow): ScoutingReport {
  return {
    id: row.id,
    scoutId: row.scout_id,
    playerId: row.player_id,
    teamId: row.team_id,
    accuracy: row.accuracy,
    reportedStats: {
      mechanical: row.reported_mechanical ?? undefined,
      gameSense: row.reported_game_sense ?? undefined,
      teamwork: row.reported_teamwork ?? undefined,
      consistency: row.reported_consistency ?? undefined,
      laning: row.reported_laning ?? undefined,
      aggression: row.reported_aggression ?? undefined,
    },
    reportedPotential: row.reported_potential,
    reportedMental: row.reported_mental,
    overallGrade: row.overall_grade as ScoutingReport['overallGrade'],
    scoutComment: row.scout_comment,
    reportDate: row.report_date,
    isCompleted: row.is_completed === 1,
    daysRemaining: row.days_remaining,
  };
}

// ─────────────────────────────────────────
// 스카우트 CRUD
// ─────────────────────────────────────────

/** 스카우트 이름 풀 (랜덤 생성용) */
const SCOUT_NAMES = [
  '김정수', '이민호', '박진우', '최승현', '정대영',
  '한동욱', '윤재혁', '강성훈', '임태준', '오승환',
  '서영진', '남기훈', '조현우', '배준형', '류동혁',
];

export async function getTeamScouts(teamId: string): Promise<Scout[]> {
  const db = await getDatabase();
  const rows = await db.select<ScoutRow[]>(
    'SELECT * FROM scouts WHERE team_id = $1 ORDER BY ability DESC',
    [teamId],
  );
  return rows.map(mapRowToScout);
}

export async function hireScout(teamId: string, hiredDate: string): Promise<Scout> {
  const db = await getDatabase();

  // 랜덤 스카우트 생성
  const name = SCOUT_NAMES[Math.floor(Math.random() * SCOUT_NAMES.length)];
  const ability = 30 + Math.floor(Math.random() * 50); // 30~79
  const regions: (Region | null)[] = ['LCK', 'LPL', 'LEC', 'LCS', null];
  const regionSpecialty = regions[Math.floor(Math.random() * regions.length)];
  const salary = 300 + Math.round(ability * 5); // 능력에 비례한 연봉

  const result = await db.execute(
    `INSERT INTO scouts (team_id, name, ability, region_specialty, salary, hired_date)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [teamId, name, ability, regionSpecialty, salary, hiredDate],
  );

  return {
    id: result.lastInsertId ?? 0,
    teamId,
    name,
    ability,
    experience: 0,
    regionSpecialty,
    salary,
    hiredDate,
  };
}

export async function fireScout(scoutId: number): Promise<void> {
  const db = await getDatabase();
  // 진행 중인 리포트도 삭제
  await db.execute('DELETE FROM scouting_reports WHERE scout_id = $1 AND is_completed = 0', [scoutId]);
  await db.execute('DELETE FROM scouts WHERE id = $1', [scoutId]);
}

// ─────────────────────────────────────────
// 스카우팅 배정 & 리포트
// ─────────────────────────────────────────

/** 스카우트에게 선수 스카우팅 배정 */
export async function assignScouting(
  scoutId: number,
  playerId: string,
  teamId: string,
  currentDate: string,
): Promise<ScoutingReport | null> {
  const db = await getDatabase();

  // 이미 진행 중인 리포트가 있는지 확인
  const existing = await db.select<ReportRow[]>(
    `SELECT * FROM scouting_reports
     WHERE scout_id = $1 AND is_completed = 0`,
    [scoutId],
  );
  if (existing.length > 0) return null; // 스카우트 바쁨

  // 스카우트 정보 가져오기
  const scoutRows = await db.select<ScoutRow[]>(
    'SELECT * FROM scouts WHERE id = $1',
    [scoutId],
  );
  if (scoutRows.length === 0) return null;

  const scout = mapRowToScout(scoutRows[0]);
  let daysRequired = calculateScoutingDays(scout.ability);

  // 스카우트 매니저 보정 (속도 -1일)
  try {
    const staffBonuses = await calculateStaffBonuses(teamId);
    daysRequired = Math.max(1, daysRequired + staffBonuses.scoutingSpeedBonus);
  } catch { /* 스태프 테이블 미생성 시 기본값 */ }

  const result = await db.execute(
    `INSERT INTO scouting_reports (scout_id, player_id, team_id, accuracy, report_date, days_remaining)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [scoutId, playerId, teamId, 0, currentDate, daysRequired],
  );

  return {
    id: result.lastInsertId ?? 0,
    scoutId,
    playerId,
    teamId,
    accuracy: 0,
    reportedStats: {},
    reportedPotential: null,
    reportedMental: null,
    overallGrade: 'C',
    scoutComment: null,
    reportDate: currentDate,
    isCompleted: false,
    daysRemaining: daysRequired,
  };
}

/** 스카우팅에 필요한 일수 (능력 높을수록 빠름) */
function calculateScoutingDays(scoutAbility: number): number {
  // 능력 80+ → 2일, 50~79 → 3일, 30~49 → 4일, 미만 → 5일
  if (scoutAbility >= 80) return 2;
  if (scoutAbility >= 50) return 3;
  if (scoutAbility >= 30) return 4;
  return 5;
}

/** 리포트 정확도 계산 */
function calculateAccuracy(scout: Scout, playerRegion: Region | null, staffAccuracyBonus = 0): number {
  let base = scout.ability; // 기본 = 스카우트 능력

  // 리전 특화 보너스
  if (scout.regionSpecialty && scout.regionSpecialty === playerRegion) {
    base += 15;
  }

  // 경험 보너스 (최대 +10)
  base += Math.min(scout.experience, 10);

  // 스카우트 매니저 보정
  base += staffAccuracyBonus;

  return Math.min(base, 100);
}

/** 스카우팅 결과에 노이즈 추가 (정확도에 반비례) */
function addNoise(realValue: number, accuracy: number): number {
  const maxDeviation = Math.round((100 - accuracy) * 0.3); // 정확도 100 → 편차 0, 정확도 50 → 편차 15
  const deviation = Math.floor(Math.random() * (maxDeviation * 2 + 1)) - maxDeviation;
  return Math.max(0, Math.min(100, realValue + deviation));
}

/** OVR 기반 등급 매기기 */
function calculateGrade(avgStat: number): ScoutingReport['overallGrade'] {
  if (avgStat >= 85) return 'S';
  if (avgStat >= 75) return 'A';
  if (avgStat >= 65) return 'B';
  if (avgStat >= 50) return 'C';
  return 'D';
}

/** 스카우트 코멘트 생성 */
function generateComment(player: Player, accuracy: number): string {
  const s = player.stats;
  const ovr = Math.round((s.mechanical + s.gameSense + s.teamwork + s.consistency + s.laning + s.aggression) / 6);

  const comments: string[] = [];

  if (accuracy >= 70) {
    if (s.mechanical >= 80) comments.push('뛰어난 기계적 실력을 보유');
    if (s.laning >= 80) comments.push('라인전이 매우 강력');
    if (s.teamwork >= 80) comments.push('팀워크가 우수');
    if (s.consistency <= 50) comments.push('일관성이 부족한 편');
    if (player.potential >= 80) comments.push('성장 잠재력이 매우 높음');
    if (player.age <= 19) comments.push('어린 나이에 비해 실력이 준수');
    if (player.age >= 27) comments.push('경험이 풍부하나 하향세 우려');
  } else {
    // 정확도 낮으면 모호한 표현
    if (ovr >= 75) comments.push('전반적으로 좋은 인상');
    else if (ovr >= 60) comments.push('평균적인 수준으로 보임');
    else comments.push('다소 부족한 모습');
    comments.push('추가 관찰이 필요');
  }

  return comments.join('. ') + '.';
}

// ─────────────────────────────────────────
// 일간 진행 — 리포트 진행도 업데이트
// ─────────────────────────────────────────

/** 하루 진행 시 스카우팅 리포트 업데이트 (dayAdvancer에서 호출) */
export async function advanceScoutingDay(teamId: string, currentDate: string): Promise<void> {
  const db = await getDatabase();

  // 진행 중인 리포트 가져오기
  type ReportRowWithScout = ReportRow & { ability: number; experience: number; region_specialty: string | null };
  const pendingRows = await db.select<ReportRowWithScout[]>(
    `SELECT sr.*, s.ability, s.experience, s.region_specialty
     FROM scouting_reports sr
     JOIN scouts s ON s.id = sr.scout_id
     WHERE sr.team_id = $1 AND sr.is_completed = 0`,
    [teamId],
  );

  for (const row of pendingRows) {
    const newDays = row.days_remaining - 1;

    if (newDays <= 0) {
      // 리포트 완료 — 실제 선수 데이터로 리포트 생성
      await completeReport(row, currentDate);
    } else {
      await db.execute(
        'UPDATE scouting_reports SET days_remaining = $1 WHERE id = $2',
        [newDays, row.id],
      );
    }
  }
}

/** 리포트 완성 — 실제 스탯에 노이즈를 더해 리포트 데이터 생성 */
async function completeReport(
  row: ReportRow & { ability: number; experience: number; region_specialty: string | null },
  currentDate: string,
): Promise<void> {
  const db = await getDatabase();

  // 실제 선수 데이터 로드
  const playerRows = await db.select<{
    mechanical: number;
    game_sense: number;
    teamwork: number;
    consistency: number;
    laning: number;
    aggression: number;
    potential: number;
    mental: number;
    team_id: string | null;
  }[]>(
    `SELECT mechanical, game_sense, teamwork, consistency, laning, aggression,
            potential, mental, team_id
     FROM players WHERE id = $1`,
    [row.player_id],
  );

  if (playerRows.length === 0) return;
  const p = playerRows[0];

  // 선수가 속한 팀의 리전 확인
  let playerRegion: Region | null = null;
  if (p.team_id) {
    const teamRows = await db.select<{ region: string }[]>(
      'SELECT region FROM teams WHERE id = $1',
      [p.team_id],
    );
    if (teamRows.length > 0) playerRegion = teamRows[0].region as Region;
  }

  const scout: Scout = {
    id: row.scout_id,
    teamId: row.team_id,
    name: '',
    ability: row.ability,
    experience: row.experience,
    regionSpecialty: row.region_specialty as Region | null,
    salary: 0,
    hiredDate: '',
  };

  // 스태프 매니저 보정
  let staffAccuracyBonus = 0;
  try {
    const staffBonuses = await calculateStaffBonuses(row.team_id);
    staffAccuracyBonus = staffBonuses.scoutingAccuracyBonus;
  } catch { /* 기본값 */ }

  const accuracy = calculateAccuracy(scout, playerRegion, staffAccuracyBonus);

  // 노이즈 추가된 스탯
  const reportedMech = addNoise(p.mechanical, accuracy);
  const reportedGS = addNoise(p.game_sense, accuracy);
  const reportedTW = addNoise(p.teamwork, accuracy);
  const reportedCon = addNoise(p.consistency, accuracy);
  const reportedLan = addNoise(p.laning, accuracy);
  const reportedAgg = addNoise(p.aggression, accuracy);
  const reportedPot = addNoise(p.potential, accuracy);
  const reportedMen = addNoise(p.mental, accuracy);

  const avgStat = Math.round(
    (reportedMech + reportedGS + reportedTW + reportedCon + reportedLan + reportedAgg) / 6,
  );
  const grade = calculateGrade(avgStat);

  // 코멘트 생성 (실제 데이터 기반)
  const realPlayer = {
    stats: {
      mechanical: p.mechanical,
      gameSense: p.game_sense,
      teamwork: p.teamwork,
      consistency: p.consistency,
      laning: p.laning,
      aggression: p.aggression,
    },
    potential: p.potential,
    age: 0, // 코멘트에서 나이 참조 시 별도 쿼리 필요
  };

  // 나이 로드
  const ageRow = await db.select<{ age: number }[]>(
    'SELECT age FROM players WHERE id = $1',
    [row.player_id],
  );
  const playerAge = ageRow.length > 0 ? ageRow[0].age : 22;

  const comment = generateComment(
    { ...realPlayer, age: playerAge } as Player,
    accuracy,
  );

  await db.execute(
    `UPDATE scouting_reports
     SET accuracy = $1,
         reported_mechanical = $2, reported_game_sense = $3,
         reported_teamwork = $4, reported_consistency = $5,
         reported_laning = $6, reported_aggression = $7,
         reported_potential = $8, reported_mental = $9,
         overall_grade = $10, scout_comment = $11,
         is_completed = 1, days_remaining = 0,
         report_date = $12
     WHERE id = $13`,
    [
      accuracy,
      reportedMech, reportedGS, reportedTW, reportedCon, reportedLan, reportedAgg,
      reportedPot, reportedMen,
      grade, comment, currentDate, row.id,
    ],
  );

  // 스카우트 경험치 +1
  await db.execute(
    'UPDATE scouts SET experience = experience + 1 WHERE id = $1',
    [row.scout_id],
  );
}

// ─────────────────────────────────────────
// 리포트 조회
// ─────────────────────────────────────────

export async function getCompletedReports(teamId: string): Promise<ScoutingReport[]> {
  const db = await getDatabase();
  const rows = await db.select<ReportRow[]>(
    `SELECT * FROM scouting_reports
     WHERE team_id = $1 AND is_completed = 1
     ORDER BY report_date DESC`,
    [teamId],
  );
  return rows.map(mapRowToReport);
}

export async function getPendingReports(teamId: string): Promise<ScoutingReport[]> {
  const db = await getDatabase();
  const rows = await db.select<ReportRow[]>(
    `SELECT * FROM scouting_reports
     WHERE team_id = $1 AND is_completed = 0
     ORDER BY days_remaining ASC`,
    [teamId],
  );
  return rows.map(mapRowToReport);
}

/** 특정 선수에 대한 최신 리포트 조회 */
export async function getPlayerReport(
  teamId: string,
  playerId: string,
): Promise<ScoutingReport | null> {
  const db = await getDatabase();
  const rows = await db.select<ReportRow[]>(
    `SELECT * FROM scouting_reports
     WHERE team_id = $1 AND player_id = $2 AND is_completed = 1
     ORDER BY report_date DESC LIMIT 1`,
    [teamId, playerId],
  );
  return rows.length > 0 ? mapRowToReport(rows[0]) : null;
}

// ─────────────────────────────────────────
// 관심 목록
// ─────────────────────────────────────────

export async function addToWatchlist(
  teamId: string,
  playerId: string,
  addedDate: string,
  notes?: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT OR IGNORE INTO scouting_watchlist (team_id, player_id, added_date, notes)
     VALUES ($1, $2, $3, $4)`,
    [teamId, playerId, addedDate, notes ?? null],
  );
}

export async function removeFromWatchlist(teamId: string, playerId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'DELETE FROM scouting_watchlist WHERE team_id = $1 AND player_id = $2',
    [teamId, playerId],
  );
}

export async function getWatchlist(teamId: string): Promise<{ playerId: string; addedDate: string; notes: string | null }[]> {
  const db = await getDatabase();
  return db.select<{ player_id: string; added_date: string; notes: string | null }[]>(
    'SELECT player_id, added_date, notes FROM scouting_watchlist WHERE team_id = $1 ORDER BY added_date DESC',
    [teamId],
  ).then(rows => rows.map(r => ({ playerId: r.player_id, addedDate: r.added_date, notes: r.notes })));
}
