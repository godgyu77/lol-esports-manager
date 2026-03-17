/**
 * 일간 캘린더 시스템
 * - FM 스타일 하루씩 진행
 * - 경기일 판별, 훈련일/휴식일 관리
 * - 시즌 스케줄과 날짜 매핑
 */

import type { Region } from '../../types/game';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

export type DayType = 'match_day' | 'training' | 'rest' | 'scrim' | 'event';

export interface CalendarDay {
  date: string;           // YYYY-MM-DD
  dayOfWeek: number;      // 0=일, 1=월, ..., 6=토
  dayType: DayType;
  matchIds: string[];     // 해당 날 경기 ID (경기일이면)
  isUserMatch: boolean;   // 유저 팀 경기가 있는 날
  weekNumber: number;     // 시즌 주차
}

interface SeasonCalendar {
  startDate: string;
  endDate: string;
  days: CalendarDay[];
  matchDates: string[];   // 경기가 있는 날짜 목록
}

// ─────────────────────────────────────────
// 날짜 유틸
// ─────────────────────────────────────────

/** YYYY-MM-DD 형식 파싱 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → YYYY-MM-DD */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 날짜에 일수 더하기 */
export function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/** 두 날짜 사이 일수 */
export function daysBetween(start: string, end: string): number {
  const s = parseDate(start);
  const e = parseDate(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
}

/** 요일 이름 */
const DAY_NAMES_KO = ['일', '월', '화', '수', '목', '금', '토'];
export function getDayName(dateStr: string): string {
  return DAY_NAMES_KO[parseDate(dateStr).getDay()];
}

// ─────────────────────────────────────────
// 시즌 캘린더 생성
// ─────────────────────────────────────────

/** 스플릿 기본 일정 (연도는 동적 치환) */
export const SEASON_DATES = {
  spring: { start: '2026-04-01', end: '2026-05-31' },
  summer: { start: '2026-07-15', end: '2026-08-31' },
} as const;

/** 대회 날짜 (연도 접두사 없이, 동적으로 year + suffix 조합) */
export const TOURNAMENT_DATES = {
  lck_cup: { start: '-01-06', end: '-02-28' },
  fst:     { start: '-03-03', end: '-03-22' },
  msi:     { start: '-06-02', end: '-06-28' },
  ewc:     { start: '-07-01', end: '-07-12' },
  worlds:  { start: '-09-15', end: '-10-31' },
} as const;

/** 대회 날짜를 연도와 조합하여 반환 */
export function getTournamentDates(
  type: keyof typeof TOURNAMENT_DATES,
  year: number,
): { start: string; end: string } {
  const dates = TOURNAMENT_DATES[type];
  return {
    start: `${year}${dates.start}`,
    end: `${year}${dates.end}`,
  };
}

/**
 * 경기 스케줄(week 기반)을 실제 날짜에 배정
 * - 주당 경기일: 수/목/금/토 (4일)
 * - 1주차 = 시즌 시작 후 첫째 주
 */
export function assignMatchDates(
  schedule: { week: number; homeTeamId: string; awayTeamId: string }[],
  startDate: string,
): { week: number; homeTeamId: string; awayTeamId: string; date: string }[] {
  // 주차별 경기 그룹핑
  const byWeek = new Map<number, typeof schedule>();
  for (const match of schedule) {
    const arr = byWeek.get(match.week) ?? [];
    arr.push(match);
    byWeek.set(match.week, arr);
  }

  const result: { week: number; homeTeamId: string; awayTeamId: string; date: string }[] = [];

  // 경기일: 수(3), 목(4), 금(5), 토(6)
  const matchDaysOfWeek = [3, 4, 5, 6];

  for (const [week, matches] of byWeek) {
    // 해당 주의 시작일 (월요일 기준)
    const weekStartOffset = (week - 1) * 7;
    const weekStart = parseDate(addDays(startDate, weekStartOffset));

    // 월요일로 정렬 (시작일이 월요일이 아닐 수 있으므로)
    const dayOfWeek = weekStart.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = addDays(formatDate(weekStart), mondayOffset);

    // 경기일에 경기 배분
    let dayIndex = 0;
    for (const match of matches) {
      const matchDayOfWeek = matchDaysOfWeek[dayIndex % matchDaysOfWeek.length];
      const daysFromMonday = matchDayOfWeek - 1; // 월=0, 화=1, ...
      const matchDate = addDays(monday, daysFromMonday);

      result.push({
        ...match,
        date: matchDate,
      });

      dayIndex++;
    }
  }

  return result;
}

/**
 * 전체 시즌 캘린더 생성
 */
function generateSeasonCalendar(
  startDate: string,
  endDate: string,
  matchSchedule: { date: string; matchId: string; homeTeamId: string; awayTeamId: string }[],
  userTeamId?: string,
): SeasonCalendar {
  const totalDays = daysBetween(startDate, endDate);
  const days: CalendarDay[] = [];
  const matchDates = new Set<string>();

  // 경기 날짜별 매핑
  const matchesByDate = new Map<string, { matchId: string; homeTeamId: string; awayTeamId: string }[]>();
  for (const m of matchSchedule) {
    matchDates.add(m.date);
    const arr = matchesByDate.get(m.date) ?? [];
    arr.push(m);
    matchesByDate.set(m.date, arr);
  }

  let weekNumber = 1;

  for (let i = 0; i <= totalDays; i++) {
    const date = addDays(startDate, i);
    const dayOfWeek = parseDate(date).getDay();
    const dayMatches = matchesByDate.get(date) ?? [];
    const isMatchDay = dayMatches.length > 0;

    // 주차 계산 (월요일 기준)
    if (dayOfWeek === 1 && i > 0) weekNumber++;

    const isUserMatch = userTeamId
      ? dayMatches.some(m => m.homeTeamId === userTeamId || m.awayTeamId === userTeamId)
      : false;

    // 일 유형 결정
    let dayType: DayType;
    if (isMatchDay) {
      dayType = 'match_day';
    } else if (dayOfWeek === 0) {
      dayType = 'rest'; // 일요일 = 휴식
    } else if (dayOfWeek === 1 || dayOfWeek === 2) {
      dayType = 'scrim'; // 월/화 = 스크림
    } else {
      dayType = 'training'; // 나머지 = 훈련
    }

    days.push({
      date,
      dayOfWeek,
      dayType,
      matchIds: dayMatches.map(m => m.matchId),
      isUserMatch,
      weekNumber,
    });
  }

  return {
    startDate,
    endDate,
    days,
    matchDates: [...matchDates].sort(),
  };
}
