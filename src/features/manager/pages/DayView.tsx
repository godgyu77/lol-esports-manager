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
import { processPlayerEvent } from '../../../engine/event/playerEventEngine';
import { getTrainingSchedule } from '../../../engine/training/trainingEngine';
import { TRAINING_TYPE_LABELS } from '../../../types/training';
import type { TrainingScheduleEntry } from '../../../types/training';
import type { DayResult } from '../../../engine/season/dayAdvancer';
import type { DayType } from '../../../engine/season/calendar';
import { OFFSEASON_PHASE_LABELS } from '../../../engine/season/offseasonEngine';
import { generateOffseasonEvents, OFFSEASON_EVENT_LABELS, type OffseasonEvent } from '../../../engine/season/offseasonEvents';
import { usePlayerStore } from '../../../stores/playerStore';
import { useTeamStore } from '../../../stores/teamStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import './DayView.css';

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
      .catch((err) => {
        console.warn('[DayView] 훈련 스케줄 로드 실패:', err);
        setTodayTraining(null);
      });
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
        useSettingsStore.getState().difficulty,
      );

      setDayResult(result);
      setCurrentDate(result.nextDate);
      setDayType(result.dayType);

      // 캐시 무효화 (일간 진행 후 데이터 갱신)
      usePlayerStore.getState().invalidateTeam(userTeamId);
      useTeamStore.getState().invalidateTeam(userTeamId);

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
        navigate('/manager/pre-match');
      } else {
        setDayPhase('idle');
        // season 날짜 동기화
        setSeason({ ...season, currentDate: result.nextDate });
      }
    } catch (err) {
      console.error('일간 진행 오류:', err);
      setDayPhase('idle');
      setDayResult(prev => prev ? { ...prev, events: [...prev.events, `⚠ 일부 처리 중 오류가 발생했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`] } : prev);
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
        useSettingsStore.getState().difficulty,
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
          navigate('/manager/pre-match');
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
    return <p className="fm-text-muted fm-text-md">데이터를 불러오는 중...</p>;
  }

  return (
    <div>
      {/* 페이지 헤더 */}
      <div className="fm-page-header">
        <h1 className="fm-page-title">시즌 진행</h1>
      </div>

      {/* 날짜 카드 */}
      <div className="dv-date-card">
        <div className="dv-date-main">
          <span className="fm-text-lg fm-text-muted">{currentDate.slice(0, 4)}년</span>
          <span className="dv-date-day">
            {currentDate.slice(5, 7)}월 {currentDate.slice(8)}일
          </span>
          <span className="fm-text-xl fm-text-secondary">({DAY_NAMES[dayOfWeek]}요일)</span>
        </div>
        <div className="dv-date-info">
          <span className="fm-badge fm-badge--default">{season.currentWeek}주차</span>
          <span className="fm-text-lg fm-font-semibold fm-text-accent">{userTeam.shortName}</span>
        </div>
      </div>

      {/* 오프시즌 배너 */}
      {dayResult?.isOffseason && dayResult.offseasonPhase && (
        <div className="fm-alert fm-alert--warning fm-mb-md">
          <span className="fm-font-bold fm-text-lg">
            {dayResult.offseasonPhase === 'preseason' ? '부트캠프' : '오프시즌'}
          </span>
          <span className="fm-badge fm-badge--default fm-font-semibold">
            {OFFSEASON_PHASE_LABELS[dayResult.offseasonPhase]}
          </span>
          <span className="fm-text-secondary fm-text-md" style={{ marginLeft: 'auto' }}>
            잔여 {dayResult.offseasonDaysRemaining ?? 0}일
          </span>
        </div>
      )}

      {/* 오프시즌 이벤트 */}
      {offseasonEvents.length > 0 && (
        <div className="fm-panel fm-mb-md">
          <div className="fm-panel__header">
            <span className="fm-panel__title">오프시즌 이벤트</span>
          </div>
          <div className="fm-panel__body">
            {offseasonEvents.map((evt, i) => (
              <div key={i} className="dv-offseason-event">
                <span className="fm-badge fm-badge--warning">
                  {OFFSEASON_EVENT_LABELS[evt.type]}
                </span>
                <div className="dv-offseason-event__content">
                  <span className="fm-text-md fm-font-semibold fm-text-primary">{evt.title}</span>
                  <span className="fm-text-base fm-text-secondary">{evt.description}</span>
                </div>
                {(evt.effects.morale || evt.effects.reputation || evt.effects.fanHappiness) && (
                  <div className="dv-offseason-event__effects">
                    {evt.effects.morale && <span className="fm-text-sm fm-text-success">사기 +{evt.effects.morale}</span>}
                    {evt.effects.reputation && <span className="fm-text-sm fm-text-info">명성 +{evt.effects.reputation}</span>}
                    {evt.effects.fanHappiness && <span className="fm-text-sm fm-text-warning">팬 +{evt.effects.fanHappiness}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 활동 선택 (비경기일) */}
      <div className="fm-panel fm-mb-md">
        <div className="fm-panel__header">
          <span className="fm-panel__title">오늘의 활동</span>
        </div>
        <div className="fm-panel__body">
          <div className="fm-grid fm-grid--3">
            {([
              { key: 'training', label: '훈련', desc: '폼↑ 체력↓' },
              { key: 'scrim', label: '스크림', desc: '폼↑↑ 체력↓↓ 사기↑' },
              { key: 'rest', label: '휴식', desc: '체력↑↑ 사기↑ 폼↓' },
            ] as const).map(({ key, label, desc }) => (
              <button
                key={key}
                className={`dv-activity-btn${selectedActivity === key ? ' dv-activity-btn--active' : ''}`}
                style={{ borderColor: selectedActivity === key ? DAY_TYPE_LABELS[key].color : undefined }}
                onClick={() => setSelectedActivity(key)}
              >
                <span className="fm-text-lg fm-font-semibold fm-text-primary">{label}</span>
                <span className="fm-text-sm fm-text-muted">{desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 훈련 미니 패널 */}
      {selectedActivity === 'training' && todayTraining && (
        <div className="fm-card fm-card--highlight fm-mb-md">
          <div className="fm-mb-sm">
            <span className="fm-text-md fm-font-semibold fm-text-info">오늘의 훈련 스케줄</span>
          </div>
          <div className="fm-flex fm-items-center fm-gap-lg fm-mb-md">
            <span className="fm-text-lg fm-font-semibold fm-text-primary">
              {TRAINING_TYPE_LABELS[todayTraining.trainingType]}
            </span>
            <span className="fm-badge fm-badge--default fm-text-md">
              강도: {todayTraining.intensity === 'light' ? '가벼운' : todayTraining.intensity === 'normal' ? '보통' : '강도 높은'}
            </span>
          </div>
          <button
            className="dv-training-link"
            onClick={() => navigate('/manager/training')}
          >
            훈련 상세 설정 →
          </button>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="fm-flex fm-gap-md fm-mb-lg">
        <button
          className="fm-btn fm-btn--primary fm-btn--lg"
          onClick={handleNextDay}
          disabled={isProcessing}
        >
          {isProcessing ? '진행 중...' : '다음 날 →'}
        </button>
        <button
          className="fm-btn fm-btn--lg"
          onClick={handleSkipToMatch}
          disabled={isProcessing}
        >
          {isProcessing ? '스킵 중...' : '경기일까지 스킵 ⏩'}
        </button>
      </div>

      {/* 하루 결과 */}
      {dayResult && (
        <div className="fm-panel fm-mb-md fm-animate-slide">
          <div className="fm-panel__header">
            <span className="fm-text-xl fm-font-semibold fm-text-primary">
              {dayResult.date} ({dayResult.dayName})
            </span>
            <span
              className="fm-badge"
              style={{
                background: DAY_TYPE_LABELS[dayResult.dayType].color + '22',
                color: DAY_TYPE_LABELS[dayResult.dayType].color,
              }}
            >
              {DAY_TYPE_LABELS[dayResult.dayType].label}
            </span>
          </div>

          <div className="fm-panel__body">
            {dayResult.events.map((evt, i) => (
              <p key={i} className="fm-text-md fm-text-secondary fm-mb-sm">• {evt}</p>
            ))}

            {/* 선수 개인 이벤트 */}
            {dayResult.playerEvents && dayResult.playerEvents.length > 0 && (
              <div className="fm-mt-md">
                {dayResult.playerEvents.map((pe) => {
                  const severityColor = pe.severity === 'critical' ? '#e74c3c'
                    : pe.severity === 'major' ? '#f39c12'
                    : pe.severity === 'moderate' ? '#3498db' : '#8a8a9a';
                  return (
                    <div
                      key={pe.id}
                      className="dv-player-event"
                      style={{
                        borderColor: `${severityColor}44`,
                        borderLeftColor: severityColor,
                        background: `${severityColor}08`,
                      }}
                    >
                      <div className="dv-player-event__header">
                        <span
                          className="dv-player-event__category"
                          style={{
                            background: `${severityColor}20`,
                            color: severityColor,
                          }}
                        >
                          {pe.category === 'military' ? '군사' : pe.category === 'scandal' ? '스캔들'
                            : pe.category === 'personal' ? '개인사' : pe.category === 'achievement' ? '업적'
                            : pe.category === 'controversy' ? '논란' : pe.category === 'growth' ? '성장'
                            : pe.category === 'media' ? '미디어' : pe.category === 'education' ? '교육' : pe.category}
                        </span>
                        <span className="fm-text-md fm-font-semibold fm-text-primary">
                          {pe.title}
                        </span>
                        <span className="fm-text-sm fm-text-muted" style={{ marginLeft: 'auto' }}>
                          {pe.playerName}
                        </span>
                      </div>
                      <p className="dv-player-event__desc">{pe.description}</p>
                      {pe.effects.moraleChange && (
                        <span
                          className="fm-text-sm"
                          style={{
                            color: pe.effects.moraleChange > 0 ? 'var(--success)' : 'var(--danger)',
                            marginRight: '8px',
                          }}
                        >
                          사기 {pe.effects.moraleChange > 0 ? '+' : ''}{pe.effects.moraleChange}
                        </span>
                      )}
                      {pe.effects.daysAbsent && pe.effects.daysAbsent > 0 && (
                        <span className="fm-text-sm fm-text-danger">결장 {pe.effects.daysAbsent}일</span>
                      )}
                      {pe.choices && pe.choices.length > 0 && (
                        <div className="fm-flex fm-gap-sm fm-flex-wrap fm-mt-sm">
                          {pe.choices.map((choice, ci) => (
                            <button
                              key={ci}
                              className="dv-choice-btn"
                              onClick={async () => {
                                if (!season || !save) return;
                                try {
                                  await processPlayerEvent(pe, season.id, season.currentDate, save.userTeamId, ci);
                                  // 선택 후 버튼 비활성화 (불변성 유지)
                                  setDayResult(prev => {
                                    if (!prev || !prev.playerEvents) return prev;
                                    return {
                                      ...prev,
                                      playerEvents: prev.playerEvents.map(e =>
                                        e.id === pe.id ? { ...e, choices: undefined } : e,
                                      ),
                                    };
                                  });
                                } catch (e) {
                                  console.warn('이벤트 선택지 처리 실패:', e);
                                }
                              }}
                              title={choice.effect}
                            >
                              {choice.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 타 팀 경기 결과 */}
            {dayResult.matchResults.length > 0 && (
              <div className="fm-mt-md">
                <div className="fm-divider" />
                <h3 className="fm-panel__title fm-text-accent fm-mb-sm">오늘의 경기 결과</h3>
                {dayResult.matchResults.map((mr) => {
                  const home = teams.find((t) => t.id === mr.homeTeamId);
                  const away = teams.find((t) => t.id === mr.awayTeamId);
                  return (
                    <div key={mr.matchId} className="fm-match-row fm-justify-center">
                      <span className="dv-match-team">{home?.shortName ?? mr.homeTeamId}</span>
                      <span className="dv-match-score">
                        {mr.result.scoreHome} : {mr.result.scoreAway}
                      </span>
                      <span className="dv-match-team">{away?.shortName ?? mr.awayTeamId}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 스킵 결과 요약 */}
      {skipResults.length > 1 && (
        <div className="fm-panel fm-animate-slide">
          <div className="fm-panel__header">
            <span className="fm-panel__title">{skipResults.length}일 스킵 완료</span>
          </div>
          <div className="fm-panel__body fm-panel__body--compact">
            {skipResults.map((dr, i) => (
              <div key={i} className="dv-skip-row">
                <span className="fm-text-md fm-text-secondary" style={{ minWidth: '120px' }}>
                  {dr.date} ({dr.dayName})
                </span>
                <span
                  className="fm-text-sm fm-font-medium"
                  style={{ color: DAY_TYPE_LABELS[dr.dayType].color }}
                >
                  {DAY_TYPE_LABELS[dr.dayType].label}
                </span>
                {dr.matchResults.length > 0 && (
                  <span className="fm-text-base fm-text-muted" style={{ marginLeft: 'auto' }}>
                    {dr.matchResults.length}경기
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
