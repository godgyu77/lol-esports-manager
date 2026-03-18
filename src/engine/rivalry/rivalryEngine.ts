/**
 * 라이벌 감독 관계 엔진
 * - 팀 간 라이벌 관계 조회/갱신
 * - 경기 전 인터뷰 수행 및 이력 관리
 */

import { getDatabase } from '../../db/database';
import type { CoachRivalry, InterviewType, PreMatchInterview } from '../../types/rivalry';

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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
  return templates[Math.floor(Math.random() * templates.length)];
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
// 경기 후 라이벌 수치 갱신
// ─────────────────────────────────────────

export async function updateRivalryAfterMatch(
  teamAId: string,
  teamBId: string,
  winnerTeamId: string,
  date: string,
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
  let consecutiveMatches = 0;

  if (existing.length > 0) {
    currentLevel = existing[0].rivalry_level;
    history = existing[0].history ?? '';

    // 연속 대결 카운트 (최근 매치가 가까울수록 변동 증가)
    if (existing[0].last_match_date) {
      const lastDate = new Date(existing[0].last_match_date);
      const currentDate = new Date(date);
      const daysDiff = Math.abs(
        (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff < 30) consecutiveMatches = 2;
      else if (daysDiff < 60) consecutiveMatches = 1;
    }
  }

  // 패배팀 rivalry -5, 연속 대결 시 추가 변동
  const loserId = winnerTeamId === teamAId ? teamBId : teamAId;
  const baseChange = -5;
  const multiplier = 1 + consecutiveMatches * 0.5;
  const change = Math.round(baseChange * multiplier);

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
  let rivalryChange = 0;
  let moraleChange = 0;

  switch (type) {
    case 'respect':
      rivalryChange = 5;
      moraleChange = 2;
      break;
    case 'confident':
      rivalryChange = 0;
      moraleChange = 5;
      break;
    case 'provocative':
      rivalryChange = -10;
      moraleChange = 8;
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
    id: result.lastInsertId,
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
