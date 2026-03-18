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
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  return (
    <div>
      <h1 style={styles.title}>캘린더</h1>

      {/* 범례 */}
      <div style={styles.legend}>
        {([
          ['match_day', '경기일'],
          ['training', '훈련'],
          ['scrim', '스크림'],
          ['rest', '휴식'],
          ['offseason', '오프시즌'],
        ] as const).map(([type, label]) => (
          <span key={type} style={styles.legendItem}>
            <span style={{ ...styles.legendDot, background: DAY_TYPE_COLORS[type] }} />
            {label}
          </span>
        ))}
      </div>

      {/* 월 네비게이션 */}
      <div style={styles.monthNav}>
        <button style={styles.navBtn} onClick={handlePrevMonth}>&lt;</button>
        <span style={styles.monthLabel}>
          {viewYear}년 {MONTH_LABELS[viewMonth]}
        </span>
        <button style={styles.navBtn} onClick={handleNextMonth}>&gt;</button>
        <button style={styles.todayBtn} onClick={handleToday}>오늘</button>
      </div>

      {isLoading && <p style={{ color: '#6a6a7a', fontSize: '13px' }}>경기 일정을 불러오는 중...</p>}

      {/* 요일 헤더 */}
      <div style={styles.grid}>
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} style={{
            ...styles.weekdayHeader,
            color: i === 0 ? '#e74c3c' : i === 6 ? '#3498db' : '#6a6a7a',
          }}>
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
              style={{
                ...styles.cell,
                background: cell.isCurrentMonth ? DAY_TYPE_BG[cell.dayType] : 'transparent',
                opacity: cell.isCurrentMonth ? 1 : 0.3,
                border: isToday ? '2px solid #c89b3c' : '1px solid rgba(255,255,255,0.04)',
                boxShadow: isToday ? '0 0 8px rgba(200,155,60,0.3)' : 'none',
              }}
            >
              <span style={{
                ...styles.cellDay,
                color: isToday ? '#c89b3c' : cell.isCurrentMonth ? '#e0e0e0' : '#4a4a5a',
                fontWeight: isToday ? 700 : 400,
              }}>
                {cell.day}
              </span>

              {/* 일정 유형 도트 */}
              {cell.isCurrentMonth && (
                <span style={{
                  ...styles.typeDot,
                  background: DAY_TYPE_COLORS[cell.dayType],
                }} />
              )}

              {/* 유저 팀 경기: 상대팀 약자 */}
              {hasUserMatch && cell.isCurrentMonth && cell.matches.map((m, j) => (
                <span key={j} style={styles.matchLabel}>
                  <span style={{ fontSize: '8px', color: '#8a8a9a' }}>
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

// ─────────────────────────────────────────
// 스타일
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '16px',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#8a8a9a',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  monthNav: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  navBtn: {
    padding: '8px 14px',
    fontSize: '16px',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    color: '#e0e0e0',
    cursor: 'pointer',
  },
  monthLabel: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0e6d2',
    minWidth: '140px',
    textAlign: 'center',
  },
  todayBtn: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 600,
    background: 'rgba(200,155,60,0.1)',
    border: '1px solid #c89b3c44',
    borderRadius: '6px',
    color: '#c89b3c',
    cursor: 'pointer',
    marginLeft: '8px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  },
  weekdayHeader: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 600,
    padding: '8px 0',
    borderBottom: '1px solid #2a2a4a',
  },
  cell: {
    minHeight: '72px',
    padding: '6px',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    position: 'relative',
  },
  cellDay: {
    fontSize: '13px',
  },
  typeDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    position: 'absolute',
    top: '8px',
    right: '8px',
  },
  matchLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#e74c3c',
    background: 'rgba(231,76,60,0.15)',
    padding: '1px 4px',
    borderRadius: '3px',
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};
