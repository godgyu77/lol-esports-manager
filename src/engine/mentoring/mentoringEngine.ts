/**
 * 멘토링 시스템
 * - 시니어 선수(25+)가 주니어 선수(22-)를 멘토링
 * - 같은 포지션 조건
 * - 멘티: 보너스 스탯 +0.05/일, 멘토: teamwork +0.02/일
 */

import { getDatabase } from '../../db/database';
import { getPlayersByTeamId } from '../../db/queries';
import type { Player } from '../../types/player';
import { getPlayerPersonality } from '../personality/personalityEngine';
import { calculatePersonalityCompatibility } from '../personality/personalityEngine';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export interface MentoringProgress {
  mentorId: string;
  menteeId: string;
  mentorName: string;
  menteeName: string;
  bonusStat: string;
  totalGrowth: number;
  daysActive: number;
  compatibility: number;
  status: 'excellent' | 'good' | 'poor';
}

export interface MentoringPair {
  id: number;
  mentorId: string;
  menteeId: string;
  teamId: string;
  startDate: string;
  bonusStat: string | null;
  dailyGrowthBonus: number;
  isActive: boolean;
}

interface MentoringRow {
  id: number;
  mentor_id: string;
  mentee_id: string;
  team_id: string;
  start_date: string;
  bonus_stat: string | null;
  daily_growth_bonus: number;
  is_active: number;
}

function mapRow(row: MentoringRow): MentoringPair {
  return {
    id: row.id,
    mentorId: row.mentor_id,
    menteeId: row.mentee_id,
    teamId: row.team_id,
    startDate: row.start_date,
    bonusStat: row.bonus_stat,
    dailyGrowthBonus: row.daily_growth_bonus,
    isActive: Boolean(row.is_active),
  };
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** 선수의 가장 높은 스탯 이름 반환 */
export function getHighestStat(player: Player): string {
  const stats = player.stats;
  const entries: [string, number][] = [
    ['mechanical', stats.mechanical],
    ['gameSense', stats.gameSense],
    ['teamwork', stats.teamwork],
    ['consistency', stats.consistency],
    ['laning', stats.laning],
    ['aggression', stats.aggression],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** 일일 멘토링 성장 로그 (세션 내 메모리 기반) */
interface MentoringGrowthEntry {
  mentoringId: number;
  menteeId: string;
  growth: number;
}

/** 누적 성장 로그 — processMentoringDay 호출마다 기록 */
const mentoringGrowthLog: MentoringGrowthEntry[] = [];

/** 성장 로그 조회 (테스트/디버깅용) */
export function getMentoringGrowthLog(): MentoringGrowthEntry[] {
  return [...mentoringGrowthLog];
}

/** snake_case → camelCase 스탯 매핑 (DB 컬럼명) */
export const STAT_TO_COLUMN: Record<string, string> = {
  mechanical: 'mechanical',
  gameSense: 'game_sense',
  teamwork: 'teamwork',
  consistency: 'consistency',
  laning: 'laning',
  aggression: 'aggression',
};

// ─────────────────────────────────────────
// 멘토링 보너스 계산
// ─────────────────────────────────────────

/** 멘토의 스탯 값에 따른 일일 성장 보너스 결정 */
export function calculateMentorGrowthBonus(statValue: number): number {
  if (statValue >= 80) return 0.15;
  if (statValue >= 70) return 0.10;
  if (statValue >= 60) return 0.05;
  return 0.02;
}

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 멘토 배정
 * 조건: 멘토 나이 >= 25, 멘티 나이 <= 22, 같은 포지션
 */
export async function assignMentor(
  mentorId: string,
  menteeId: string,
  teamId: string,
  startDate: string,
): Promise<{ success: boolean; message: string }> {
  const players = await getPlayersByTeamId(teamId);
  const mentor = players.find(p => p.id === mentorId);
  const mentee = players.find(p => p.id === menteeId);

  if (!mentor || !mentee) {
    return { success: false, message: '선수를 찾을 수 없습니다.' };
  }

  if (mentor.age < 25) {
    return { success: false, message: '멘토는 25세 이상이어야 합니다.' };
  }

  if (mentee.age > 22) {
    return { success: false, message: '멘티는 22세 이하여야 합니다.' };
  }

  if (mentor.position !== mentee.position) {
    return { success: false, message: '멘토와 멘티는 같은 포지션이어야 합니다.' };
  }

  const bonusStat = getHighestStat(mentor);

  // 멘토의 해당 스탯 값에 따른 성장 보너스 결정
  const mentorStatValue = (mentor.stats as unknown as Record<string, number>)[bonusStat] ?? 50;
  const dailyGrowthBonus = calculateMentorGrowthBonus(mentorStatValue);

  const db = await getDatabase();

  // 기존 멘토링 비활성화
  await db.execute(
    'UPDATE player_mentoring SET is_active = 0 WHERE mentee_id = $1',
    [menteeId],
  );

  await db.execute(
    `INSERT INTO player_mentoring (mentor_id, mentee_id, team_id, start_date, bonus_stat, daily_growth_bonus, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, 1)`,
    [mentorId, menteeId, teamId, startDate, bonusStat, dailyGrowthBonus],
  );

  return { success: true, message: `${mentor.name}이(가) ${mentee.name}의 멘토로 배정되었습니다. (보너스: ${bonusStat}, 일일 성장: +${dailyGrowthBonus.toFixed(2)})` };
}

/**
 * 멘토 해제
 */
export async function removeMentor(menteeId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE player_mentoring SET is_active = 0 WHERE mentee_id = $1',
    [menteeId],
  );
}

/**
 * 일간 멘토링 효과 처리
 * - 멘티: 보너스 스탯 성장 (멘토 능력/성격 호환/멘티 결단력 반영)
 * - 멘토: teamwork +0.02/일, stamina -0.01/일 (멘토링 부담)
 */
export async function processMentoringDay(teamId: string): Promise<void> {
  const db = await getDatabase();
  const pairs = await getMentoringPairs(teamId);

  for (const pair of pairs) {
    if (!pair.bonusStat) continue;

    const column = STAT_TO_COLUMN[pair.bonusStat];
    if (!column) continue;

    let effectiveBonus = pair.dailyGrowthBonus;

    // 멘토 스태미나 체크: 피로 시 효율 하락
    const mentorRows = await db.select<{ stamina: number }[]>(
      'SELECT stamina FROM players WHERE id = $1',
      [pair.mentorId],
    );
    const mentorStamina = mentorRows[0]?.stamina ?? 50;
    if (mentorStamina < 30) {
      effectiveBonus *= 0.5; // 스태미나 30 미만 → 효율 50% 감소
    }

    // 성격 호환성 체크: 호환 → 1.5x, 비호환 → 0.5x
    try {
      const mentorPersonality = await getPlayerPersonality(pair.mentorId);
      const menteePersonality = await getPlayerPersonality(pair.menteeId);
      const compatibility = calculatePersonalityCompatibility(mentorPersonality, menteePersonality);
      if (compatibility >= 5) {
        effectiveBonus *= 1.5; // 호환 우수
      } else if (compatibility <= -5) {
        effectiveBonus *= 0.5; // 비호환
      }

      // 멘티 결단력 보너스: 높은 결단력 → +30% 학습 속도
      if (menteePersonality.determination >= 7) {
        effectiveBonus *= 1.3;
      }
    } catch {
      // 성격 데이터 없으면 기본 배율 유지
    }

    // 멘티 보너스 스탯 증가
    await db.execute(
      `UPDATE players SET ${column} = MIN(${column} + $1, 100) WHERE id = $2`,
      [effectiveBonus, pair.menteeId],
    );

    // 멘토 teamwork 증가
    await db.execute(
      'UPDATE players SET teamwork = MIN(teamwork + $1, 100) WHERE id = $2',
      [0.02, pair.mentorId],
    );

    // 멘토 스태미나 소모 (멘토링 부담)
    await db.execute(
      'UPDATE players SET stamina = MAX(stamina - 0.01, 0) WHERE id = $1',
      [pair.mentorId],
    );

    // 성장 추적: 일일 성장량을 누적 기록 (notes 없으므로 별도 추적 불가 → daily_growth_bonus * 일수로 추정)
    // processMentoringDay 호출 시마다의 effectiveBonus를 로그로 남기기 위해
    // scrim_results처럼 별도 테이블이 없으므로, 실제 성장량은 getMentoringProgress에서 추정
    mentoringGrowthLog.push({
      mentoringId: pair.id,
      menteeId: pair.menteeId,
      growth: effectiveBonus,
    });
  }
}

/**
 * 현재 멘토링 쌍 조회
 */
export async function getMentoringPairs(teamId: string): Promise<MentoringPair[]> {
  const db = await getDatabase();
  const rows = await db.select<MentoringRow[]>(
    'SELECT * FROM player_mentoring WHERE team_id = $1 AND is_active = 1',
    [teamId],
  );
  return rows.map(mapRow);
}

/**
 * 멘토 자격 선수 목록 (25세 이상)
 */
export async function getEligibleMentors(teamId: string): Promise<Player[]> {
  const players = await getPlayersByTeamId(teamId);
  return players.filter(p => p.age >= 25);
}

/**
 * 멘티 자격 선수 목록 (22세 이하, 현재 멘토링 받고 있지 않은)
 */
export async function getEligibleMentees(teamId: string): Promise<Player[]> {
  const players = await getPlayersByTeamId(teamId);
  const activePairs = await getMentoringPairs(teamId);
  const menteeIds = new Set(activePairs.map(p => p.menteeId));
  return players.filter(p => p.age <= 22 && !menteeIds.has(p.id));
}

// ─────────────────────────────────────────
// 멘토링 결과 추적
// ─────────────────────────────────────────

/**
 * 활성 멘토링 쌍의 누적 성장 기록 조회
 * - totalGrowth: daily_growth_bonus × 활성 일수 (대략적 추정)
 * - compatibility: 성격 호환성 점수
 * - status: compatibility 기반 등급
 */
export async function getMentoringProgress(teamId: string): Promise<MentoringProgress[]> {
  const db = await getDatabase();

  try {
    const rows = await db.select<(MentoringRow & {
      mentor_name: string;
      mentee_name: string;
    })[]>(
      `SELECT pm.*,
              mentor.name as mentor_name,
              mentee.name as mentee_name
       FROM player_mentoring pm
       JOIN players mentor ON mentor.id = pm.mentor_id
       JOIN players mentee ON mentee.id = pm.mentee_id
       WHERE pm.team_id = $1 AND pm.is_active = 1`,
      [teamId],
    );

    const results: MentoringProgress[] = [];

    for (const row of rows) {
      // 활성 일수 계산
      const startDate = new Date(row.start_date);
      const now = new Date();
      const daysActive = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

      // 대략적 누적 성장량 추정
      const totalGrowth = Math.round(row.daily_growth_bonus * daysActive * 100) / 100;

      // 성격 호환성 계산
      let compatibility = 0;
      try {
        const mentorPersonality = await getPlayerPersonality(row.mentor_id);
        const menteePersonality = await getPlayerPersonality(row.mentee_id);
        compatibility = calculatePersonalityCompatibility(mentorPersonality, menteePersonality);
      } catch {
        // 성격 데이터 없으면 0 유지
      }

      // 상태 판정
      let status: MentoringProgress['status'] = 'good';
      if (compatibility >= 5) status = 'excellent';
      else if (compatibility < 0) status = 'poor';

      results.push({
        mentorId: row.mentor_id,
        menteeId: row.mentee_id,
        mentorName: row.mentor_name,
        menteeName: row.mentee_name,
        bonusStat: row.bonus_stat ?? 'unknown',
        totalGrowth,
        daysActive,
        compatibility,
        status,
      });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * 멘토링 완료 처리
 * - is_active = 0으로 변경
 * - 뉴스 기사 생성 (멘토링 완료 알림)
 */
export async function completeMentoring(
  mentoringId: number,
  teamId: string,
  seasonId: number,
): Promise<{ message: string }> {
  const db = await getDatabase();

  try {
    // 멘토링 정보 조회
    const rows = await db.select<(MentoringRow & {
      mentor_name: string;
      mentee_name: string;
    })[]>(
      `SELECT pm.*,
              mentor.name as mentor_name,
              mentee.name as mentee_name
       FROM player_mentoring pm
       JOIN players mentor ON mentor.id = pm.mentor_id
       JOIN players mentee ON mentee.id = pm.mentee_id
       WHERE pm.id = $1`,
      [mentoringId],
    );

    if (rows.length === 0) {
      return { message: '멘토링 기록을 찾을 수 없습니다.' };
    }

    const pair = rows[0];

    // 활성 일수 계산
    const startDate = new Date(pair.start_date);
    const now = new Date();
    const daysActive = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const totalGrowth = Math.round(pair.daily_growth_bonus * daysActive * 100) / 100;

    // 멘토링 비활성화
    await db.execute(
      'UPDATE player_mentoring SET is_active = 0 WHERE id = $1',
      [mentoringId],
    );

    // 뉴스 기사 생성
    const title = `멘토링 완료: ${pair.mentor_name} → ${pair.mentee_name}`;
    const content = `${pair.mentor_name}의 멘토링이 ${daysActive}일간 진행된 후 완료되었습니다. ` +
      `${pair.mentee_name}의 ${pair.bonus_stat ?? '종합'} 능력치가 약 ${totalGrowth} 성장한 것으로 추정됩니다.`;

    await db.execute(
      `INSERT INTO news_articles (season_id, article_date, category, title, content, related_team_id, importance, is_read)
       VALUES ($1, datetime('now'), 'team', $2, $3, $4, 2, 0)`,
      [seasonId, title, content, teamId],
    );

    return { message: `${pair.mentor_name} → ${pair.mentee_name} 멘토링이 완료되었습니다. (${daysActive}일, 추정 성장: +${totalGrowth})` };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return { message: `멘토링 완료 처리 중 오류: ${errorMsg}` };
  }
}
