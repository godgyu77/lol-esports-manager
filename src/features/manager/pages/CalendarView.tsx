/**
 * 캘린더 뷰
 * - 월별 달력 그리드 (7열 x 5~6행)
 * - 날짜 셀에 일정 표시 (경기일=빨강, 훈련=파랑, 스크림=초록, 휴식=회색, 오프시즌=보라)
 * - 경기일에는 상대팀 약자 표시
 * - 현재 날짜 골드 테두리
 * - 이전/다음 월 이동
 */

import { useEffect, useState, useCallback } from 'react';
import { useGameStore } from '../../../stores/gameStore';
import { getMatchesBySeason } from '../../../db/queries';
import type { Match } from '../../../types/match';

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────

type CalendarDayType = 'match_day' | 'training' | 'scrim' | 'rest' | 'offseason';

interface CalendarCell {
  date: string;          // YYYY-MM-DD
  day: number;           // 일
  dayType: CalendarDayType;
  isCurrentMonth: boolean;
  matches: { opponentShortName: string; isHome: boolean }[];
}

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

const DAY_TYPE_COLORS: Record<CalendarDayType, string> = {
  match_day: '#e74c3c',
  training: '#3498db',
  scrim: '#2ecc71',
  rest: '#6a6a7a',
  offseason: '#9b59b6',
};

const DAY_TYPE_BG: Record<CalendarDayType, string> = {
  match_day: 'rgba(231,76,60,0.12)',
  training: 'rgba(52,152,219,0.08)',
  scrim: 'rgba(46,204,113,0.08)',
  rest: 'rgba(106,106,122,0.06)',
  offseason: 'rgba(155,89,182,0.08)',
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function determineDayType(dayOfWeek: number, hasMatch: boolean, isInSeason: boolean): CalendarDayType {
  if (!isInSeason) return 'offseason';
  if (hasMatch) return 'match_day';
  if (dayOfWeek === 0) return 'rest';
  if (dayOfWeek === 1 || dayOfWeek === 2) return 'scrim';
  return 'training';
}

// ─────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────

export function CalendarView() {
  const season = useGameStore((s) => s.season);
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const currentDate = season?.currentDate ?? '2026-01-12';
  const userTeamId = save?.userTeamId ?? '';

  // 현재 표시 중인 월 (0-indexed)
  const [viewYear, setViewYear] = useState(() => parseInt(currentDate.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(currentDate.slice(5, 7)) - 1);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 시즌 경기 로딩
  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    setIsLoading(true);
    getMatchesBySeason(season.id)
      .then((data) => {
        if (!cancelled) setMatches(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [season]);

  // 이전/다음 월 이동
  const handlePrevMonth = useCallback(() => {
    setViewMonth(prev => {
      if (prev === 0) {
        setViewYear(y => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewMonth(prev => {
      if (prev === 11) {
        setViewYear(y => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  // 오늘로 돌아가기
  const handleToday = useCallback(() => {
    setViewYear(parseInt(currentDate.slice(0, 4)));
    setViewMonth(parseInt(currentDate.slice(5, 7)) - 1);
  }, [currentDate]);

  // 팀 shortName 매핑
  const teamMap = new Map(teams.map(t => [t.id, t.shortName]));

  // 날짜별 경기 매핑
  const matchesByDate = new Map<string, { opponentShortName: string; isHome: boolean }[]>();
  for (const match of matches) {
    if (!match.matchDate) continue;
    const isUserHome = match.teamHomeId === userTeamId;
    const isUserAway = match.teamAwayId === userTeamId;
    if (!isUserHome && !isUserAway) continue;

    const opponentId = isUserHome ? match.teamAwayId : match.teamHomeId;
    const entry = {
      opponentShortName: teamMap.get(opponentId) ?? opponentId.slice(0, 3).toUpperCase(),
      isHome: isUserHome,
    };

    const existing = matchesByDate.get(match.matchDate) ?? [];
    existing.push(entry);
    matchesByDate.set(match.matchDate, existing);
  }

  // 모든 경기 날짜 (유저 팀 이외 포함)
  const allMatchDates = new Set<string>();
  for (const match of matches) {
    if (match.matchDate) allMatchDates.add(match.matchDate);
  }

  // 시즌 범위
  const seasonStart = season?.startDate ?? '2026-01-01';
  const seasonEnd = season?.endDate ?? '2026-12-31';

  // 캘린더 그리드 생성
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

  const cells: CalendarCell[] = [];

  // 이전 달 패딩
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = formatDate(prevYear, prevMonth, d);
    const dow = new Date(prevYear, prevMonth, d).getDay();
    const hasMatch = allMatchDates.has(dateStr);
    const isInSeason = dateStr >= seasonStart && dateStr <= seasonEnd;

    cells.push({
      date: dateStr,
      day: d,
      dayType: determineDayType(dow, hasMatch, isInSeason),
      isCurrentMonth: false,
      matches: matchesByDate.get(dateStr) ?? [],
    });
  }

  // 현재 달
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(viewYear, viewMonth, d);
    const dow = new Date(viewYear, viewMonth, d).getDay();
    const hasMatch = allMatchDates.has(dateStr);
    const isInSeason = dateStr >= seasonStart && dateStr <= seasonEnd;

    cells.push({
      date: dateStr,
      day: d,
      dayType: determineDayType(dow, hasMatch, isInSeason),
      isCurrentMonth: true,
      matches: matchesByDate.get(dateStr) ?? [],
    });
  }

  // 다음 달 패딩 (6행 = 42셀)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = formatDate(nextYear, nextMonth, d);
    const dow = new Date(nextYear, nextMonth, d).getDay();
    const hasMatch = allMatchDates.has(dateStr);
    const isInSeason = dateStr >= seasonStart && dateStr <= seasonEnd;

    cells.push({
      date: dateStr,
      day: d,
      dayType: determineDayType(dow, hasMatch, isInSeason),
      isCurrentMonth: false,
      matches: matchesByDate.get(dateStr) ?? [],
    });
  }

  if (!season) {
    return <p className="fm-text-muted">데이터를 불러오는 중...</p>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">캘린더</h1>
      </div>

      {/* 범례 */}
      <div className="fm-flex fm-flex-wrap fm-gap-md fm-mb-md">
        {([
          ['match_day', '경기일'],
          ['training', '훈련'],
          ['scrim', '스크림'],
          ['rest', '휴식'],
          ['offseason', '오프시즌'],
        ] as const).map(([type, label]) => (
          <span key={type} className="fm-flex fm-items-center fm-gap-xs fm-text-base fm-text-secondary">
            <span style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', background: DAY_TYPE_COLORS[type] }} />
            {label}
          </span>
        ))}
      </div>

      {/* 월 네비게이션 */}
      <div className="fm-flex fm-items-center fm-gap-sm fm-mb-md">
        <button className="fm-btn" onClick={handlePrevMonth}>&lt;</button>
        <span className="fm-text-xl fm-font-bold fm-text-primary fm-text-center" style={{ minWidth: 140 }}>
          {viewYear}년 {MONTH_LABELS[viewMonth]}
        </span>
        <button className="fm-btn" onClick={handleNextMonth}>&gt;</button>
        <button className="fm-btn fm-btn--primary fm-btn--sm" onClick={handleToday} style={{ marginLeft: 8 }}>오늘</button>
      </div>

      {isLoading && <p className="fm-text-muted fm-text-md fm-mb-sm">경기 일정을 불러오는 중...</p>}

      {/* 요일 헤더 + 날짜 셀 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={i}
            className={`fm-text-base fm-font-semibold fm-text-center ${
              i === 0 ? 'fm-text-danger' : i === 6 ? 'fm-text-info' : 'fm-text-muted'
            }`}
            style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}
          >
            {label}
          </div>
        ))}

        {/* 날짜 셀 */}
        {cells.map((cell, i) => {
          const isToday = cell.date === currentDate;
          const hasUserMatch = cell.matches.length > 0;

          return (
            <div
              key={i}
              className="fm-flex-col"
              style={{
                minHeight: 72,
                padding: 6,
                borderRadius: 6,
                gap: 2,
                position: 'relative',
                background: cell.isCurrentMonth ? DAY_TYPE_BG[cell.dayType] : 'transparent',
                opacity: cell.isCurrentMonth ? 1 : 0.3,
                border: isToday ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                boxShadow: isToday ? '0 0 8px rgba(200,155,60,0.3)' : 'none',
              }}
            >
              <span
                className={`fm-text-md ${isToday ? 'fm-text-accent fm-font-bold' : cell.isCurrentMonth ? 'fm-text-primary' : 'fm-text-muted'}`}
              >
                {cell.day}
              </span>

              {/* 일정 유형 도트 */}
              {cell.isCurrentMonth && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: DAY_TYPE_COLORS[cell.dayType],
                  }}
                />
              )}

              {/* 유저 팀 경기: 상대팀 약자 */}
              {hasUserMatch && cell.isCurrentMonth && cell.matches.map((m, j) => (
                <span
                  key={j}
                  className="fm-text-xs fm-font-semibold fm-truncate"
                  style={{
                    color: '#e74c3c',
                    background: 'rgba(231,76,60,0.15)',
                    padding: '1px 4px',
                    borderRadius: 3,
                    marginTop: 2,
                  }}
                >
                  <span className="fm-text-xs fm-text-secondary">
                    {m.isHome ? 'vs' : '@'}
                  </span>
                  {' '}{m.opponentShortName}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
