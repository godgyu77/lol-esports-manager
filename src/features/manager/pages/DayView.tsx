/**
 * 일간 진행 뷰 (FM 스타일)
 * - 현재 날짜/요일/활동 유형 표시
 * - "다음 날" / "경기일까지 스킵" 버튼
 * - 경기 결과 표시
 * - 유저 경기 시 밴픽 → 라이브 매치 분기
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { advanceDay, skipToNextMatchDay } from '../../../engine/season/dayAdvancer';
import { getTrainingSchedule } from '../../../engine/training/trainingEngine';
import { TRAINING_TYPE_LABELS } from '../../../types/training';
import type { TrainingScheduleEntry } from '../../../types/training';
import type { DayResult } from '../../../engine/season/dayAdvancer';
import type { DayType } from '../../../engine/season/calendar';
import { OFFSEASON_PHASE_LABELS } from '../../../engine/season/offseasonEngine';
import { generateOffseasonEvents, OFFSEASON_EVENT_LABELS, type OffseasonEvent } from '../../../engine/season/offseasonEvents';

type ActivityChoice = 'training' | 'scrim' | 'rest';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DAY_TYPE_LABELS: Record<DayType, { label: string; color: string }> = {
  match_day: { label: '경기일', color: '#e74c3c' },
  training: { label: '훈련', color: '#3498db' },
  scrim: { label: '스크림', color: '#9b59b6' },
  rest: { label: '휴식', color: '#2ecc71' },
  event: { label: '이벤트', color: '#f39c12' },
};

export function DayView() {
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
  const setFearlessPool = useGameStore((s) => s.setFearlessPool);
  const resetSeries = useMatchStore((s) => s.resetSeries);

  const [dayResult, setDayResult] = useState<DayResult | null>(null);
  const [skipResults, setSkipResults] = useState<DayResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityChoice>('training');
  const [todayTraining, setTodayTraining] = useState<TrainingScheduleEntry | null>(null);
  const [offseasonEvents, setOffseasonEvents] = useState<OffseasonEvent[]>([]);

  const currentDate = season?.currentDate ?? '2026-01-12';
  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find((t) => t.id === userTeamId);

  // 현재 날짜의 요일
  const dateObj = new Date(currentDate.replace(/-/g, '/'));
  const dayOfWeek = dateObj.getDay();

  // 훈련 스케줄 로드
  useEffect(() => {
    if (!userTeamId) return;
    getTrainingSchedule(userTeamId)
      .then((schedule) => {
        const entry = schedule.find((s) => s.dayOfWeek === dayOfWeek) ?? null;
        setTodayTraining(entry);
      })
      .catch(() => setTodayTraining(null));
  }, [userTeamId, dayOfWeek]);

  // 오프시즌 이벤트 생성
  useEffect(() => {
    if (dayResult?.isOffseason && userTeam) {
      const events = generateOffseasonEvents(userTeam.reputation);
      setOffseasonEvents(events);
    } else {
      setOffseasonEvents([]);
    }
  }, [dayResult?.isOffseason, userTeam]);

  const handleNextDay = useCallback(async () => {
    if (!season || !save) return;
    setIsProcessing(true);
    setDayPhase('processing');
    setSkipResults([]);

    try {
      const result = await advanceDay(
        season.id,
        currentDate,
        userTeamId,
        save.mode,
        selectedActivity,
        save.id,
      );

      setDayResult(result);
      setCurrentDate(result.nextDate);
      setDayType(result.dayType);

      if (result.isSeasonEnd) {
        // 시즌 종료 → 시즌 종료 화면으로
        setDayPhase('idle');
        setSeason({ ...season, currentDate: result.nextDate });
        navigate('/manager/season-end');
      } else if (result.hasUserMatch && result.userMatch) {
        // 유저 팀 경기 → 밴픽으로 분기 (시리즈 상태 초기화)
        resetSeries();
        setFearlessPool({ blue: [], red: [] });
        setPendingUserMatch(result.userMatch);
        setDayPhase('banpick');
        navigate('/manager/draft');
      } else {
        setDayPhase('idle');
        // season 날짜 동기화
        setSeason({ ...season, currentDate: result.nextDate });
      }
    } catch (err) {
      console.error('일간 진행 오류:', err);
      setDayPhase('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [season, save, currentDate, userTeamId, navigate, setDayPhase, setSeason, setPendingUserMatch, setCurrentDate, setDayType, selectedActivity, resetSeries, setFearlessPool]);

  const handleSkipToMatch = useCallback(async () => {
    if (!season || !save) return;
    setIsProcessing(true);
    setDayPhase('processing');
    setDayResult(null);

    try {
      const results = await skipToNextMatchDay(
        season.id,
        currentDate,
        userTeamId,
        save.mode,
        season.endDate,
        selectedActivity,
      );

      setSkipResults(results);

      const lastResult = results[results.length - 1];
      if (lastResult) {
        setCurrentDate(lastResult.nextDate);
        setDayType(lastResult.dayType);
        setSeason({ ...season, currentDate: lastResult.nextDate });

        if (lastResult.isSeasonEnd) {
          setDayPhase('idle');
          navigate('/manager/season-end');
          return;
        }

        if (lastResult.hasUserMatch && lastResult.userMatch) {
          resetSeries();
          setFearlessPool({ blue: [], red: [] });
          setPendingUserMatch(lastResult.userMatch);
          setDayPhase('banpick');
          navigate('/manager/draft');
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
  }, [season, save, currentDate, userTeamId, navigate, setDayPhase, setSeason, setPendingUserMatch, setCurrentDate, setDayType, selectedActivity, resetSeries, setFearlessPool]);

  // Space키로 다음 날 진행 (처리 중이 아닐 때만)
  const handleNextDayRef = useRef(handleNextDay);
  handleNextDayRef.current = handleNextDay;
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;

  useKeyboardShortcuts({
    onAdvanceDay: useCallback(() => {
      if (!isProcessingRef.current) {
        handleNextDayRef.current();
      }
    }, []),
  });

  if (!season || !save || !userTeam) {
    return <p style={{ color: 'var(--text-muted)' }}>데이터를 불러오는 중...</p>;
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
          <span style={styles.teamLabel}>{userTeam.shortName}</span>
        </div>
      </div>

      {/* 오프시즌 배너 */}
      {dayResult?.isOffseason && dayResult.offseasonPhase && (
        <div style={styles.offseasonBanner}>
          <span style={styles.offseasonTitle}>
            {dayResult.offseasonPhase === 'preseason' ? '부트캠프' : '오프시즌'}
          </span>
          <span style={styles.offseasonPhase}>
            {OFFSEASON_PHASE_LABELS[dayResult.offseasonPhase]}
          </span>
          <span style={styles.offseasonDays}>
            잔여 {dayResult.offseasonDaysRemaining ?? 0}일
          </span>
        </div>
      )}

      {/* 오프시즌 이벤트 */}
      {offseasonEvents.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.subTitle}>오프시즌 이벤트</h3>
          {offseasonEvents.map((evt, i) => (
            <div key={i} style={dayViewStyles.offseasonEventRow}>
              <span style={dayViewStyles.offseasonEventBadge}>
                {OFFSEASON_EVENT_LABELS[evt.type]}
              </span>
              <div style={dayViewStyles.offseasonEventContent}>
                <span style={dayViewStyles.offseasonEventTitle}>{evt.title}</span>
                <span style={dayViewStyles.offseasonEventDesc}>{evt.description}</span>
              </div>
              {(evt.effects.morale || evt.effects.reputation || evt.effects.fanHappiness) && (
                <div style={dayViewStyles.offseasonEventEffects}>
                  {evt.effects.morale && <span style={{ color: '#2ecc71', fontSize: '11px' }}>사기 +{evt.effects.morale}</span>}
                  {evt.effects.reputation && <span style={{ color: '#3498db', fontSize: '11px' }}>명성 +{evt.effects.reputation}</span>}
                  {evt.effects.fanHappiness && <span style={{ color: '#f39c12', fontSize: '11px' }}>팬 +{evt.effects.fanHappiness}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 활동 선택 (비경기일) */}
      <div style={styles.activityPanel}>
        <span style={styles.activityLabel}>오늘의 활동:</span>
        <div style={styles.activityBtnGroup}>
          {([
            { key: 'training', label: '훈련', desc: '폼↑ 체력↓' },
            { key: 'scrim', label: '스크림', desc: '폼↑↑ 체력↓↓ 사기↑' },
            { key: 'rest', label: '휴식', desc: '체력↑↑ 사기↑ 폼↓' },
          ] as const).map(({ key, label, desc }) => (
            <button
              key={key}
              style={{
                ...styles.activityBtn,
                ...(selectedActivity === key ? styles.activityBtnActive : {}),
                borderColor: DAY_TYPE_LABELS[key].color,
              }}
              onClick={() => setSelectedActivity(key)}
            >
              <span style={styles.activityBtnLabel}>{label}</span>
              <span style={styles.activityBtnDesc}>{desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 훈련 미니 패널 */}
      {selectedActivity === 'training' && todayTraining && (
        <div style={styles.trainingMiniPanel}>
          <div style={styles.trainingMiniHeader}>
            <span style={styles.trainingMiniTitle}>오늘의 훈련 스케줄</span>
          </div>
          <div style={styles.trainingMiniContent}>
            <span style={styles.trainingMiniType}>
              {TRAINING_TYPE_LABELS[todayTraining.trainingType]}
            </span>
            <span style={styles.trainingMiniIntensity}>
              강도: {todayTraining.intensity === 'light' ? '가벼운' : todayTraining.intensity === 'normal' ? '보통' : '강도 높은'}
            </span>
          </div>
          <button
            style={styles.trainingDetailBtn}
            onClick={() => navigate('/manager/training')}
          >
            훈련 상세 설정 →
          </button>
        </div>
      )}

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

          {/* 타 팀 경기 결과 */}
          {dayResult.matchResults.length > 0 && (
            <div style={styles.matchResults}>
              <h3 style={styles.subTitle}>오늘의 경기 결과</h3>
              {dayResult.matchResults.map((mr) => {
                const home = teams.find((t) => t.id === mr.homeTeamId);
                const away = teams.find((t) => t.id === mr.awayTeamId);
                return (
                  <div key={mr.matchId} style={styles.matchRow}>
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
    color: 'var(--text-primary)',
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
    color: 'var(--text-muted)',
  },
  dateDay: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  dateDow: {
    fontSize: '16px',
    color: 'var(--text-secondary)',
  },
  dateInfo: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
  },
  weekLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    background: 'rgba(255,255,255,0.05)',
    padding: '4px 10px',
    borderRadius: '4px',
  },
  teamLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--accent)',
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
    background: 'var(--accent)',
    color: 'var(--bg-primary)',
  },
  btnSecondary: {
    background: 'transparent',
    border: '1px solid #3a3a5c',
    color: 'var(--text-secondary)',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
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
    color: 'var(--text-primary)',
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
    color: 'var(--text-secondary)',
    marginBottom: '4px',
  },
  matchResults: {
    marginTop: '16px',
    borderTop: '1px solid var(--border)',
    paddingTop: '12px',
  },
  subTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--accent)',
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
  matchTeam: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    minWidth: '60px',
    textAlign: 'center',
  },
  matchScore: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
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
    color: 'var(--text-secondary)',
    minWidth: '120px',
  },
  skipExtra: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginLeft: 'auto',
  },
  activityPanel: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '16px',
  },
  activityLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '10px',
    display: 'block',
  },
  activityBtnGroup: {
    display: 'flex',
    gap: '10px',
  },
  activityBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px',
    padding: '12px 8px',
    borderRadius: '8px',
    border: '1px solid #3a3a5c',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activityBtnActive: {
    background: 'rgba(200,155,60,0.12)',
    borderColor: 'var(--accent)',
  },
  activityBtnLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  activityBtnDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  trainingMiniPanel: {
    background: 'rgba(52,152,219,0.06)',
    border: '1px solid rgba(52,152,219,0.3)',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '16px',
  },
  trainingMiniHeader: {
    marginBottom: '10px',
  },
  trainingMiniTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#3498db',
  },
  trainingMiniContent: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    marginBottom: '12px',
  },
  trainingMiniType: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  trainingMiniIntensity: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    background: 'rgba(255,255,255,0.05)',
    padding: '3px 10px',
    borderRadius: '4px',
  },
  trainingDetailBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#3498db',
    background: 'transparent',
    border: '1px solid rgba(52,152,219,0.3)',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  offseasonBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    background: 'linear-gradient(135deg, rgba(243,156,18,0.12) 0%, rgba(231,76,60,0.08) 100%)',
    border: '1px solid rgba(243,156,18,0.3)',
    borderRadius: '10px',
    padding: '16px 20px',
    marginBottom: '16px',
  },
  offseasonTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--warning)',
  },
  offseasonPhase: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    background: 'rgba(255,255,255,0.08)',
    padding: '4px 12px',
    borderRadius: '6px',
  },
  offseasonDays: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginLeft: 'auto',
  },
};

const dayViewStyles: Record<string, React.CSSProperties> = {
  offseasonEventRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  offseasonEventBadge: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--warning)',
    background: 'rgba(243,156,18,0.1)',
    padding: '3px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap',
  },
  offseasonEventContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
  },
  offseasonEventTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  offseasonEventDesc: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },
  offseasonEventEffects: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
};
