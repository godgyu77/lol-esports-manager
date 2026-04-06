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
import { useMatchStore } from '../../../stores/matchStore';
import { advanceDay, skipToNextMatchDay } from '../../../engine/season/dayAdvancer';
import type { DayResult } from '../../../engine/season/dayAdvancer';
import type { DayType } from '../../../engine/season/calendar';
import { useSettingsStore } from '../../../stores/settingsStore';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DAY_TYPE_LABELS: Record<DayType, { label: string; badge: string }> = {
  match_day: { label: '경기일', badge: 'fm-badge--danger' },
  training: { label: '훈련', badge: 'fm-badge--info' },
  scrim: { label: '스크림', badge: 'fm-badge--accent' },
  rest: { label: '휴식', badge: 'fm-badge--success' },
  event: { label: '이벤트', badge: 'fm-badge--warning' },
};

export function PlayerDayView() {
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

  const currentDate = season?.currentDate ?? '2025-12-01';
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

    try {
      const result = await advanceDay(
        season.id,
        currentDate,
        userTeamId,
        save.mode,
        'training', // 선수 모드는 기본 훈련
        undefined,
        useSettingsStore.getState().difficulty,
      );

      setDayResult(result);
      setCurrentDate(result.nextDate);
      setDayType(result.dayType);

      if (result.isSeasonEnd) {
        setDayPhase('idle');
        setSeason({ ...season, currentDate: result.nextDate });
        navigate('/player/season-end');
      } else if (result.hasUserMatch && result.userMatch) {
        // 유저 팀 경기 → 밴픽(AI 자동) → 라이브 매치로 분기
        resetSeries();
        setFearlessPool({ blue: [], red: [] });
        setPendingUserMatch(result.userMatch);
        setDayPhase('banpick');
        setSeason({ ...season, currentDate: result.nextDate });
        navigate('/player/draft');
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
  }, [season, save, currentDate, userTeamId, navigate, setDayPhase, setSeason, setPendingUserMatch, setCurrentDate, setDayType, resetSeries, setFearlessPool]);

  // 경기일까지 스킵
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
        'training',
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
          navigate('/player/season-end');
          return;
        }

        if (lastResult.hasUserMatch && lastResult.userMatch) {
          resetSeries();
          setFearlessPool({ blue: [], red: [] });
          setPendingUserMatch(lastResult.userMatch);
          setDayPhase('banpick');
          navigate('/player/draft');
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
  }, [season, save, currentDate, userTeamId, navigate, setDayPhase, setSeason, setPendingUserMatch, setCurrentDate, setDayType, resetSeries, setFearlessPool]);

  if (!season || !save || !userTeam) {
    return <p className="fm-text-secondary fm-text-md">데이터를 불러오는 중...</p>;
  }

  return (
    <div>
      <div className="fm-page-header">
        <h1 className="fm-page-title">시즌 진행</h1>
      </div>

      {/* 날짜 카드 */}
      <div className="fm-panel">
        <div className="fm-panel__body">
          <div className="fm-flex fm-justify-between fm-items-center">
            <div className="fm-flex fm-items-center fm-gap-sm">
              <span className="fm-text-md fm-text-muted">{currentDate.slice(0, 4)}년</span>
              <span className="fm-text-2xl fm-font-bold fm-text-primary">
                {currentDate.slice(5, 7)}월 {currentDate.slice(8)}일
              </span>
              <span className="fm-text-xl fm-text-secondary">({DAY_NAMES[dayOfWeek]}요일)</span>
            </div>
            <div className="fm-flex fm-gap-md fm-items-center">
              <span className="fm-badge fm-badge--default">{season.currentWeek}주차</span>
              {myPlayer && (
                <span className="fm-text-lg fm-font-semibold fm-text-info">{myPlayer.name}</span>
              )}
              <span className="fm-text-lg fm-font-semibold fm-text-accent">{userTeam.shortName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 선수 안내 메시지 */}
      <div className="fm-alert fm-alert--info">
        <span className="fm-alert__icon">i</span>
        <span className="fm-alert__text">
          선수 모드에서는 팀 일정에 따라 자동으로 훈련이 진행됩니다.
          경기일에는 밴픽(AI 자동) 후 라이브 경기를 관전합니다.
        </span>
      </div>

      {/* 액션 버튼 */}
      <div className="fm-flex fm-gap-sm fm-mb-lg">
        <button
          className="fm-btn fm-btn--primary fm-btn--lg"
          onClick={handleNextDay}
          disabled={isProcessing}
        >
          {isProcessing ? '진행 중...' : '다음 날 진행'}
        </button>
        <button
          className="fm-btn fm-btn--lg"
          onClick={handleSkipToMatch}
          disabled={isProcessing}
        >
          {isProcessing ? '스킵 중...' : '경기일까지 스킵'}
        </button>
      </div>

      {/* 하루 결과 */}
      {dayResult && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <div className="fm-flex fm-items-center fm-gap-sm">
              <span className="fm-panel__title">
                {dayResult.date} ({dayResult.dayName})
              </span>
              <span className={`fm-badge ${DAY_TYPE_LABELS[dayResult.dayType].badge}`}>
                {DAY_TYPE_LABELS[dayResult.dayType].label}
              </span>
            </div>
          </div>
          <div className="fm-panel__body">
            {dayResult.events.map((evt, i) => (
              <p key={i} className="fm-text-md fm-text-secondary fm-mb-sm">• {evt}</p>
            ))}

            {/* 경기 결과 */}
            {dayResult.matchResults.length > 0 && (
              <div>
                <div className="fm-divider" />
                <h3 className="fm-text-lg fm-font-semibold fm-text-accent fm-mb-sm">오늘의 경기 결과</h3>
                {dayResult.matchResults.map((mr) => {
                  const home = teams.find((t) => t.id === mr.homeTeamId);
                  const away = teams.find((t) => t.id === mr.awayTeamId);
                  const isMyMatch = mr.isUserMatch;
                  return (
                    <div
                      key={mr.matchId}
                      className={`fm-match-row ${isMyMatch ? 'fm-table__row--selected' : ''}`}
                    >
                      {isMyMatch && <span className="fm-badge fm-badge--accent">내 팀</span>}
                      <span className="fm-text-lg fm-font-medium fm-text-primary" style={{ minWidth: '60px', textAlign: 'center' }}>
                        {home?.shortName ?? mr.homeTeamId}
                      </span>
                      <span className="fm-text-xl fm-font-bold fm-text-primary" style={{ minWidth: '60px', textAlign: 'center' }}>
                        {mr.result.scoreHome} : {mr.result.scoreAway}
                      </span>
                      <span className="fm-text-lg fm-font-medium fm-text-primary" style={{ minWidth: '60px', textAlign: 'center' }}>
                        {away?.shortName ?? mr.awayTeamId}
                      </span>
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
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">{skipResults.length}일 스킵 완료</span>
          </div>
          <div className="fm-panel__body--flush">
            <table className="fm-table fm-table--striped">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>유형</th>
                  <th className="text-right">비고</th>
                </tr>
              </thead>
              <tbody>
                {skipResults.map((dr, i) => (
                  <tr key={i}>
                    <td className="fm-cell--name">{dr.date} ({dr.dayName})</td>
                    <td>
                      <span className={`fm-badge ${DAY_TYPE_LABELS[dr.dayType].badge}`}>
                        {DAY_TYPE_LABELS[dr.dayType].label}
                      </span>
                    </td>
                    <td className="text-right fm-text-muted">
                      {dr.matchResults.length > 0 ? `${dr.matchResults.length}경기` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
