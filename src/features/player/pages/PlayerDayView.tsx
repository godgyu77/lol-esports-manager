/**
 * 선수 모드 시즌 진행 뷰
 * - 감독 모드 DayView를 참고하되 선수 관점으로 단순화
 * - "다음 날로" 버튼으로 시즌 진행
 * - 경기가 있는 날이면 "경기 진행" 버튼 표시 (자동 시뮬 후 결과)
 * - 활동 선택 없이 자동으로 팀 일정에 따름
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { advanceDay, skipToNextMatchDay } from '../../../engine/season/dayAdvancer';
import type { DayResult } from '../../../engine/season/dayAdvancer';
import type { DayType } from '../../../engine/season/calendar';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DAY_TYPE_LABELS: Record<DayType, { label: string; color: string }> = {
  match_day: { label: '경기일', color: '#e74c3c' },
  training: { label: '훈련', color: '#3498db' },
  scrim: { label: '스크림', color: '#9b59b6' },
  rest: { label: '휴식', color: '#2ecc71' },
  event: { label: '이벤트', color: '#f39c12' },
};

export function PlayerDayView() {
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const dayPhase = useGameStore((s) => s.dayPhase);
  const setDayPhase = useGameStore((s) => s.setDayPhase);
  const setSeason = useGameStore((s) => s.setSeason);
  const setPendingUserMatch = useGameStore((s) => s.setPendingUserMatch);
  const setCurrentDate = useGameStore((s) => s.setCurrentDate);
  const setDayType = useGameStore((s) => s.setDayType);

  const [dayResult, setDayResult] = useState<DayResult | null>(null);
  const [skipResults, setSkipResults] = useState<DayResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchCompleted, setMatchCompleted] = useState(false);

  const currentDate = season?.currentDate ?? '2026-01-12';
  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find((t) => t.id === userTeamId);
  const myPlayer = userTeam?.roster.find((p) => p.id === save?.userPlayerId);

  // 현재 날짜의 요일
  const dateObj = new Date(currentDate.replace(/-/g, '/'));
  const dayOfWeek = dateObj.getDay();

  // 다음 날 진행 (선수 모드는 활동 선택 없이 훈련 기본)
  const handleNextDay = useCallback(async () => {
    if (!season || !save) return;
    setIsProcessing(true);
    setDayPhase('processing');
    setSkipResults([]);
    setMatchCompleted(false);

    try {
      const result = await advanceDay(
        season.id,
        currentDate,
        userTeamId,
        save.mode,
        'training', // 선수 모드는 기본 훈련
      );

      setDayResult(result);
      setCurrentDate(result.nextDate);
      setDayType(result.dayType);

      if (result.isSeasonEnd) {
        setDayPhase('idle');
        setSeason({ ...season, currentDate: result.nextDate });
        navigate('/player');
      } else if (result.hasUserMatch && result.userMatch) {
        // 선수 모드: 경기가 있으면 자동 시뮬 결과 표시
        setPendingUserMatch(result.userMatch);
        setMatchCompleted(true);
        setDayPhase('idle');
        setSeason({ ...season, currentDate: result.nextDate });
      } else {
        setDayPhase('idle');
        setSeason({ ...season, currentDate: result.nextDate });
      }
    } catch (err) {
      console.error('일간 진행 오류:', err);
      setDayPhase('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [season, save, currentDate, userTeamId, navigate, setDayPhase, setSeason, setPendingUserMatch, setCurrentDate, setDayType]);

  // 경기일까지 스킵
  const handleSkipToMatch = useCallback(async () => {
    if (!season || !save) return;
    setIsProcessing(true);
    setDayPhase('processing');
    setDayResult(null);
    setMatchCompleted(false);

    try {
      const results = await skipToNextMatchDay(
        season.id,
        currentDate,
        userTeamId,
        save.mode,
        season.endDate,
        'training',
      );

      setSkipResults(results);

      const lastResult = results[results.length - 1];
      if (lastResult) {
        setCurrentDate(lastResult.nextDate);
        setDayType(lastResult.dayType);
        setSeason({ ...season, currentDate: lastResult.nextDate });

        if (lastResult.isSeasonEnd) {
          setDayPhase('idle');
          navigate('/player');
          return;
        }

        if (lastResult.hasUserMatch && lastResult.userMatch) {
          setPendingUserMatch(lastResult.userMatch);
          setMatchCompleted(true);
          setDayPhase('idle');
          return;
        }
      }

      setDayPhase('idle');
    } catch (err) {
      console.error('스킵 오류:', err);
      setDayPhase('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [season, save, currentDate, userTeamId, navigate, setDayPhase, setSeason, setPendingUserMatch, setCurrentDate, setDayType]);

  if (!season || !save || !userTeam) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  return (
    <div>
      <h1 style={styles.title}>시즌 진행</h1>

      {/* 날짜 카드 */}
      <div style={styles.dateCard}>
        <div style={styles.dateMain}>
          <span style={styles.dateYear}>{currentDate.slice(0, 4)}년</span>
          <span style={styles.dateDay}>
            {currentDate.slice(5, 7)}월 {currentDate.slice(8)}일
          </span>
          <span style={styles.dateDow}>({DAY_NAMES[dayOfWeek]}요일)</span>
        </div>
        <div style={styles.dateInfo}>
          <span style={styles.weekLabel}>{season.currentWeek}주차</span>
          {myPlayer && (
            <span style={styles.playerLabel}>{myPlayer.name}</span>
          )}
          <span style={styles.teamLabel}>{userTeam.shortName}</span>
        </div>
      </div>

      {/* 선수 안내 메시지 */}
      <div style={styles.infoPanel}>
        <span style={styles.infoText}>
          선수 모드에서는 팀 일정에 따라 자동으로 훈련이 진행됩니다.
          경기일에는 경기 결과를 확인할 수 있습니다.
        </span>
      </div>

      {/* 액션 버튼 */}
      <div style={styles.actionRow}>
        <button
          style={{
            ...styles.btn,
            ...styles.btnPrimary,
            opacity: isProcessing ? 0.5 : 1,
          }}
          onClick={handleNextDay}
          disabled={isProcessing}
        >
          {isProcessing ? '진행 중...' : '다음 날 →'}
        </button>
        <button
          style={{
            ...styles.btn,
            ...styles.btnSecondary,
            opacity: isProcessing ? 0.5 : 1,
          }}
          onClick={handleSkipToMatch}
          disabled={isProcessing}
        >
          {isProcessing ? '스킵 중...' : '경기일까지 스킵 ⏩'}
        </button>
      </div>

      {/* 경기 알림 - 유저 팀 경기가 있었을 때 */}
      {matchCompleted && dayResult?.userMatch && (
        <div style={styles.matchAlert}>
          <h3 style={styles.matchAlertTitle}>내 팀 경기 완료!</h3>
          <p style={styles.matchAlertDesc}>
            오늘 경기가 자동으로 진행되었습니다. 결과는 아래에서 확인하세요.
          </p>
        </div>
      )}

      {/* 하루 결과 */}
      {dayResult && (
        <div style={styles.card}>
          <div style={styles.resultHeader}>
            <span style={styles.resultDate}>
              {dayResult.date} ({dayResult.dayName})
            </span>
            <span
              style={{
                ...styles.dayTypeBadge,
                background: DAY_TYPE_LABELS[dayResult.dayType].color + '22',
                color: DAY_TYPE_LABELS[dayResult.dayType].color,
              }}
            >
              {DAY_TYPE_LABELS[dayResult.dayType].label}
            </span>
          </div>

          {dayResult.events.map((evt, i) => (
            <p key={i} style={styles.eventText}>• {evt}</p>
          ))}

          {/* 경기 결과 */}
          {dayResult.matchResults.length > 0 && (
            <div style={styles.matchResults}>
              <h3 style={styles.subTitle}>오늘의 경기 결과</h3>
              {dayResult.matchResults.map((mr) => {
                const home = teams.find((t) => t.id === mr.homeTeamId);
                const away = teams.find((t) => t.id === mr.awayTeamId);
                const isMyMatch = mr.isUserMatch;
                return (
                  <div
                    key={mr.matchId}
                    style={{
                      ...styles.matchRow,
                      ...(isMyMatch ? styles.matchRowHighlight : {}),
                    }}
                  >
                    {isMyMatch && <span style={styles.myMatchTag}>내 팀</span>}
                    <span style={styles.matchTeam}>{home?.shortName ?? mr.homeTeamId}</span>
                    <span style={styles.matchScore}>
                      {mr.result.scoreHome} : {mr.result.scoreAway}
                    </span>
                    <span style={styles.matchTeam}>{away?.shortName ?? mr.awayTeamId}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 스킵 결과 요약 */}
      {skipResults.length > 1 && (
        <div style={styles.card}>
          <h3 style={styles.subTitle}>{skipResults.length}일 스킵 완료</h3>
          {skipResults.map((dr, i) => (
            <div key={i} style={styles.skipRow}>
              <span style={styles.skipDate}>{dr.date} ({dr.dayName})</span>
              <span
                style={{
                  ...styles.dayTypeBadgeSmall,
                  color: DAY_TYPE_LABELS[dr.dayType].color,
                }}
              >
                {DAY_TYPE_LABELS[dr.dayType].label}
              </span>
              {dr.matchResults.length > 0 && (
                <span style={styles.skipExtra}>
                  {dr.matchResults.length}경기
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  dateCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #1a1a3a 0%, #12122a 100%)',
    border: '1px solid #c89b3c44',
    borderRadius: '12px',
    padding: '24px 28px',
    marginBottom: '20px',
  },
  dateMain: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  dateYear: {
    fontSize: '14px',
    color: '#6a6a7a',
  },
  dateDay: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#f0e6d2',
  },
  dateDow: {
    fontSize: '16px',
    color: '#8a8a9a',
  },
  dateInfo: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: '14px',
    color: '#8a8a9a',
    background: 'rgba(255,255,255,0.05)',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  playerLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#a0d0ff',
  },
  teamLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c89b3c',
  },
  infoPanel: {
    background: 'rgba(52,152,219,0.08)',
    border: '1px solid rgba(52,152,219,0.2)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
  },
  infoText: {
    fontSize: '13px',
    color: '#8a8a9a',
    lineHeight: '1.5',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  btn: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  btnPrimary: {
    background: '#c89b3c',
    color: '#0d0d1a',
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid #3a3a5c',
    color: '#8a8a9a',
  },
  matchAlert: {
    background: 'rgba(231,76,60,0.1)',
    border: '1px solid rgba(231,76,60,0.3)',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '16px',
  },
  matchAlertTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#e74c3c',
    marginBottom: '6px',
  },
  matchAlertDesc: {
    fontSize: '13px',
    color: '#8a8a9a',
    margin: 0,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  resultDate: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  dayTypeBadge: {
    fontSize: '12px',
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: '12px',
  },
  dayTypeBadgeSmall: {
    fontSize: '11px',
    fontWeight: 500,
  },
  eventText: {
    fontSize: '13px',
    color: '#8a8a9a',
    marginBottom: '4px',
  },
  matchResults: {
    marginTop: '16px',
    borderTop: '1px solid #2a2a4a',
    paddingTop: '12px',
  },
  subTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '10px',
  },
  matchRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.03)',
  },
  matchRowHighlight: {
    background: 'rgba(200,155,60,0.08)',
    borderRadius: '6px',
    padding: '8px 12px',
  },
  myMatchTag: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.15)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
  matchTeam: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
    minWidth: '60px',
    textAlign: 'center',
  },
  matchScore: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#f0e6d2',
    minWidth: '60px',
    textAlign: 'center',
  },
  skipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '6px 0',
    borderBottom: '1px solid rgba(255,255,255,0.02)',
  },
  skipDate: {
    fontSize: '13px',
    color: '#8a8a9a',
    minWidth: '120px',
  },
  skipExtra: {
    fontSize: '12px',
    color: '#6a6a7a',
    marginLeft: 'auto',
  },
};
