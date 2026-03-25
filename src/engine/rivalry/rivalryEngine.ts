/**
 * 라이벌 감독 관계 엔진
 * - 팀 간 라이벌 관계 조회/갱신
 * - 경기 전 인터뷰 수행 및 이력 관리
 */

import { getDatabase } from '../../db/database';
import type { CoachRivalry, InterviewType, PreMatchInterview } from '../../types/rivalry';
import type { MatchType } from '../../types/match';
import { clamp } from '../../utils/mathUtils';
import { pickRandom } from '../../utils/random';

// ─────────────────────────────────────────
// Row 매핑
// ─────────────────────────────────────────

interface RivalryRow {
  id: number;
  team_a_id: string;
  team_b_id: string;
  rivalry_level: number;
  history: string | null;
  last_match_date: string | null;
}

interface InterviewRow {
  id: number;
  match_id: string;
  team_id: string;
  interview_type: string;
  response_text: string;
  rivalry_change: number;
  morale_change: number;
  created_date: string;
}

function mapRowToRivalry(row: RivalryRow): CoachRivalry {
  return {
    teamAId: row.team_a_id,
    teamBId: row.team_b_id,
    rivalryLevel: row.rivalry_level,
    history: row.history,
    lastMatchDate: row.last_match_date,
  };
}

function mapRowToInterview(row: InterviewRow): PreMatchInterview {
  return {
    id: row.id,
    matchId: row.match_id,
    teamId: row.team_id,
    interviewType: row.interview_type as InterviewType,
    responseText: row.response_text,
    rivalryChange: row.rivalry_change,
    moraleChange: row.morale_change,
  };
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

function orderTeamIds(teamAId: string, teamBId: string): [string, string] {
  return teamAId < teamBId ? [teamAId, teamBId] : [teamBId, teamAId];
}

// ─────────────────────────────────────────
// 인터뷰 텍스트 템플릿
// ─────────────────────────────────────────

const INTERVIEW_TEMPLATES: Record<InterviewType, string[]> = {
  respect: [
    '상대팀은 항상 좋은 경기를 보여줍니다. 우리도 최선을 다하겠습니다.',
    '상대 감독님을 존경합니다. 좋은 경기가 되길 바랍니다.',
    '강한 상대와 경기하는 것 자체가 영광입니다. 최선을 다하겠습니다.',
    '상대팀 선수들의 노력에 경의를 표합니다. 멋진 경기가 되길 기대합니다.',
  ],
  confident: [
    '우리 팀의 준비는 완벽합니다. 좋은 결과를 기대합니다.',
    '이번 주 훈련 결과가 매우 좋았습니다. 자신 있습니다.',
    '선수들의 컨디션이 최상입니다. 기대해 주세요.',
    '우리가 준비한 전략이 통할 것이라고 확신합니다.',
  ],
  provocative: [
    '솔직히 상대팀의 최근 경기력은 실망스러웠습니다. 쉬운 경기가 될 것 같습니다.',
    '상대팀이 어떤 전략을 가져와도 우리를 이길 수 없을 겁니다.',
    '상대팀 팬들에게 미리 사과드립니다. 오늘 경기는 일방적일 겁니다.',
    '솔직히 상대팀 수준이라면 2군을 내보내도 이길 수 있다고 생각합니다.',
  ],
};

function generateInterviewText(type: InterviewType): string {
  const templates = INTERVIEW_TEMPLATES[type];
  return pickRandom(templates);
}

// ─────────────────────────────────────────
// 라이벌 관계 조회
// ─────────────────────────────────────────

export async function getRivalry(
  teamAId: string,
  teamBId: string,
): Promise<CoachRivalry | null> {
  const db = await getDatabase();
  const [a, b] = orderTeamIds(teamAId, teamBId);

  const rows = await db.select<RivalryRow[]>(
    'SELECT * FROM coach_rivalries WHERE team_a_id = ? AND team_b_id = ?',
    [a, b],
  );

  if (rows.length === 0) return null;
  return mapRowToRivalry(rows[0]);
}

// ─────────────────────────────────────────
// 매치 타입 판별 유틸
// ─────────────────────────────────────────

const PLAYOFF_MATCH_TYPES: ReadonlySet<string> = new Set([
  'playoff_quarters', 'playoff_semis', 'playoff_finals',
  'lck_cup_playoff_quarters', 'lck_cup_playoff_semis', 'lck_cup_playoff_finals',
]);

const INTERNATIONAL_MATCH_TYPES: ReadonlySet<string> = new Set([
  'msi_group', 'msi_semis', 'msi_final',
  'worlds_swiss', 'worlds_quarter', 'worlds_semi', 'worlds_final',
  'first_stand_group', 'first_stand_playoff',
  'ewc_group', 'ewc_playoff',
]);

function isPlayoffMatch(matchType?: MatchType): boolean {
  return matchType ? PLAYOFF_MATCH_TYPES.has(matchType) : false;
}

function isInternationalMatch(matchType?: MatchType): boolean {
  return matchType ? INTERNATIONAL_MATCH_TYPES.has(matchType) : false;
}

// ─────────────────────────────────────────
// 경기 후 라이벌 수치 갱신
// ─────────────────────────────────────────

export async function updateRivalryAfterMatch(
  teamAId: string,
  teamBId: string,
  winnerTeamId: string,
  date: string,
  options?: {
    /** 승리팀 세트 스코어 */
    winnerScore?: number;
    /** 패배팀 세트 스코어 */
    loserScore?: number;
    /** 매치 타입 (플레이오프/국제전 판별용) */
    matchType?: MatchType;
  },
): Promise<CoachRivalry> {
  const db = await getDatabase();
  const [a, b] = orderTeamIds(teamAId, teamBId);

  // 기존 관계 조회 또는 생성
  const existing = await db.select<RivalryRow[]>(
    'SELECT * FROM coach_rivalries WHERE team_a_id = ? AND team_b_id = ?',
    [a, b],
  );

  let currentLevel = 0;
  let history = '';

  if (existing.length > 0) {
    currentLevel = existing[0].rivalry_level;
    history = existing[0].history ?? '';
  }

  // 점수 차이에 따른 기본 라이벌 변동량
  const winnerScore = options?.winnerScore ?? 2;
  const loserScore = options?.loserScore ?? 0;
  const scoreDiff = winnerScore - loserScore;
  const baseChange = scoreDiff <= 1 ? 10 : 3; // 접전 +10, 대패 +3

  // 매치 타입별 배율
  let typeMultiplier = 1.0;
  if (isPlayoffMatch(options?.matchType)) {
    typeMultiplier = 2.0;
  } else if (isInternationalMatch(options?.matchType)) {
    typeMultiplier = 1.5;
  }

  const change = Math.round(baseChange * typeMultiplier);
  const newLevel = clamp(currentLevel + change, -100, 100);

  // 이력 업데이트
  const winnerLabel = winnerTeamId === a ? 'A' : 'B';
  const newHistory = history
    ? `${history}|${date}:${winnerLabel}`
    : `${date}:${winnerLabel}`;

  // 최근 5경기만 유지
  const historyEntries = newHistory.split('|');
  const trimmedHistory = historyEntries.slice(-5).join('|');

  if (existing.length > 0) {
    await db.execute(
      `UPDATE coach_rivalries
       SET rivalry_level = ?, history = ?, last_match_date = ?
       WHERE team_a_id = ? AND team_b_id = ?`,
      [newLevel, trimmedHistory, date, a, b],
    );
  } else {
    await db.execute(
      `INSERT INTO coach_rivalries (team_a_id, team_b_id, rivalry_level, history, last_match_date)
       VALUES (?, ?, ?, ?, ?)`,
      [a, b, newLevel, trimmedHistory, date],
    );
  }

  return {
    teamAId: a,
    teamBId: b,
    rivalryLevel: newLevel,
    history: trimmedHistory,
    lastMatchDate: date,
  };
}

/**
 * 복수전 보너스 조회
 * 최근 2경기 연속 패배 시 "설욕전" 사기 보너스 +3% 반환
 * @returns 복수전 사기 보너스 (0 또는 3)
 */
export async function getRevengeBonus(
  teamId: string,
  opponentId: string,
): Promise<number> {
  const [a, b] = orderTeamIds(teamId, opponentId);
  const db = await getDatabase();

  const rows = await db.select<RivalryRow[]>(
    'SELECT * FROM coach_rivalries WHERE team_a_id = ? AND team_b_id = ?',
    [a, b],
  );

  if (rows.length === 0 || !rows[0].history) return 0;

  const historyEntries = rows[0].history.split('|');
  if (historyEntries.length < 2) return 0;

  // 최근 2경기 확인
  const teamLabel = teamId === a ? 'A' : 'B';
  const recent2 = historyEntries.slice(-2);
  const lostBoth = recent2.every(entry => {
    const winner = entry.split(':')[1] ?? '';
    return winner !== teamLabel; // 해당 팀이 이기지 못한 경기
  });

  return lostBoth ? 3 : 0;
}

// ─────────────────────────────────────────
// 경기 전 인터뷰
// ─────────────────────────────────────────

export async function conductPreMatchInterview(
  matchId: string,
  teamId: string,
  opponentId: string,
  type: InterviewType,
  date: string,
): Promise<PreMatchInterview> {
  const db = await getDatabase();

  const responseText = generateInterviewText(type);

  // 인터뷰 타입별 효과
  // provocative: rivalry +15, 상대 morale -3 (자팀 사기 반영 없음 → moraleChange = -3 은 상대에 적용)
  // respect: rivalry -5, 양측 morale +2
  let rivalryChange = 0;
  let moraleChange = 0;

  switch (type) {
    case 'respect':
      rivalryChange = -5;
      moraleChange = 2; // 양측 +2
      break;
    case 'confident':
      rivalryChange = 0;
      moraleChange = 5;
      break;
    case 'provocative':
      rivalryChange = 15;
      moraleChange = -3; // 상대 morale -3
      break;
  }

  // 인터뷰 기록 저장
  const result = await db.execute(
    `INSERT INTO pre_match_interviews
     (match_id, team_id, interview_type, response_text, rivalry_change, morale_change, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [matchId, teamId, type, responseText, rivalryChange, moraleChange, date],
  );

  // 라이벌 관계 업데이트
  const [a, b] = orderTeamIds(teamId, opponentId);
  const existing = await db.select<RivalryRow[]>(
    'SELECT * FROM coach_rivalries WHERE team_a_id = ? AND team_b_id = ?',
    [a, b],
  );

  if (existing.length > 0) {
    const newLevel = clamp(existing[0].rivalry_level + rivalryChange, -100, 100);
    await db.execute(
      `UPDATE coach_rivalries SET rivalry_level = ? WHERE team_a_id = ? AND team_b_id = ?`,
      [newLevel, a, b],
    );
  } else if (rivalryChange !== 0) {
    await db.execute(
      `INSERT INTO coach_rivalries (team_a_id, team_b_id, rivalry_level) VALUES (?, ?, ?)`,
      [a, b, clamp(rivalryChange, -100, 100)],
    );
  }

  return {
    id: result.lastInsertId ?? 0,
    matchId,
    teamId,
    interviewType: type,
    responseText,
    rivalryChange,
    moraleChange,
  };
}

// ─────────────────────────────────────────
// 인터뷰 이력 조회
// ─────────────────────────────────────────

export async function getInterviewHistory(
  matchId: string,
): Promise<PreMatchInterview[]> {
  const db = await getDatabase();

  const rows = await db.select<InterviewRow[]>(
    'SELECT * FROM pre_match_interviews WHERE match_id = ? ORDER BY id',
    [matchId],
  );

  return rows.map(mapRowToInterview);
}
