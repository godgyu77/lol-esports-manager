import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { advanceDay, skipToNextMatchDay, type DayResult } from '../../../engine/season/dayAdvancer';
import type { DayType } from '../../../engine/season/calendar';
import { getActiveSeason } from '../../../db/queries';
import { getManagerIdentity, getManagerIdentitySummaryLine } from '../../../engine/manager/managerIdentityEngine';
import { getActiveInterventionEffects } from '../../../engine/manager/managerInterventionEngine';
import { generateStaffRecommendations } from '../../../engine/staff/staffEngine';
import { getTrainingSchedule } from '../../../engine/training/trainingEngine';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import { usePlayerStore } from '../../../stores/playerStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useTeamStore } from '../../../stores/teamStore';
import { TRAINING_ACTIVITY_LABELS, TRAINING_TYPE_LABELS, type TrainingScheduleEntry } from '../../../types/training';
import './DayView.css';

type ImpactTone = 'positive' | 'risk' | 'neutral';

interface ImpactSummaryItem {
  title: string;
  detail: string;
  tone: ImpactTone;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DAY_TYPE_LABELS: Record<DayType, string> = {
  match_day: '경기일',
  training: '훈련일',
  scrim: '스크림',
  rest: '휴식일',
  event: '이벤트',
};

function getAutoActivity(entry: TrainingScheduleEntry | null): 'training' | 'scrim' | 'rest' {
  return entry?.activityType ?? 'training';
}

function getDecisionImpact(activity: DayType, training: TrainingScheduleEntry | null): string {
  if (activity === 'rest') return '회복에 집중하는 날입니다. 다음 경기 전까지 체력과 사기가 안정될 가능성이 높습니다.';
  if (activity === 'scrim') {
    return training
      ? `${TRAINING_TYPE_LABELS[training.trainingType]} 중심 준비가 오늘 스크림 피드백에 그대로 반영될 가능성이 큽니다.`
      : '스크림은 실전 감각을 끌어올리고 약점을 드러내는 데 가장 빠른 구간입니다.';
  }
  if (activity === 'match_day') return '최근 준비 결과가 실제 경기 성과로 드러나는 날입니다.';
  return training
    ? `오늘 성장의 중심은 ${TRAINING_TYPE_LABELS[training.trainingType]} 훈련입니다.`
    : '기본 훈련 루틴으로도 컨디션과 폼을 안정적으로 유지할 수 있습니다.';
}

function getResultHighlights(result: DayResult, training: TrainingScheduleEntry | null): string[] {
  const highlights: string[] = [];

  if (result.dayType !== 'match_day') {
    highlights.push(`적용 일정: ${DAY_TYPE_LABELS[result.dayType]}`);
  }

  if (training && result.dayType !== 'rest' && result.dayType !== 'match_day') {
    highlights.push(`훈련 포커스: ${TRAINING_TYPE_LABELS[training.trainingType]} / 강도 ${training.intensity}`);
  }

  if (result.events.length > 0) {
    highlights.push(`핵심 변화: ${result.events[0]}`);
  }

  if (highlights.length === 0) {
    highlights.push('큰 변수 없이 계획한 일정대로 하루가 진행됐습니다.');
  }

  return highlights;
}

function getToneClass(tone: ImpactTone): string {
  if (tone === 'positive') return 'fm-text-success';
  if (tone === 'risk') return 'fm-text-danger';
  return 'fm-text-accent';
}

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
  const setHardFearlessSeries = useMatchStore((s) => s.setHardFearlessSeries);
  const setCurrentGameDraftRequired = useMatchStore((s) => s.setCurrentGameDraftRequired);
  const setSeriesFearlessPool = useMatchStore((s) => s.setSeriesFearlessPool);
  const resetSeries = useMatchStore((s) => s.resetSeries);

  const [dayResult, setDayResult] = useState<DayResult | null>(null);
  const [skipResults, setSkipResults] = useState<DayResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [todayTraining, setTodayTraining] = useState<TrainingScheduleEntry | null>(null);
  const [impactSummary, setImpactSummary] = useState<ImpactSummaryItem[]>([]);

  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find((team) => team.id === userTeamId);
  const currentDate = season?.currentDate ?? '';
  const dateObj = currentDate ? new Date(currentDate.replace(/-/g, '/')) : new Date();
  const dayOfWeek = dateObj.getDay();
  const autoActivity = getAutoActivity(todayTraining);

  useEffect(() => {
    if (!userTeamId) return;

    getTrainingSchedule(userTeamId)
      .then((schedule) => {
        const todayEntry = schedule.find((entry) => entry.dayOfWeek === dayOfWeek) ?? null;
        setTodayTraining(todayEntry);
      })
      .catch((error) => {
        console.warn('[DayView] failed to load training schedule:', error);
        setTodayTraining(null);
      });
  }, [dayOfWeek, userTeamId]);

  useEffect(() => {
    if (!season || !save || !userTeam) return;

    let cancelled = false;

    const loadImpactSummary = async () => {
      try {
        const [identity, interventions, recommendations] = await Promise.all([
          getManagerIdentity(save.id).catch(() => null),
          getActiveInterventionEffects(season.currentDate).catch(() => new Map()),
          generateStaffRecommendations(userTeam.id, season.id).catch(() => []),
        ]);

        if (cancelled) return;

        const items: ImpactSummaryItem[] = [];

        items.push({
          title: '이번 주 운영 기조',
          detail: todayTraining
            ? `${TRAINING_ACTIVITY_LABELS[autoActivity]} / ${TRAINING_TYPE_LABELS[todayTraining.trainingType]} / ${todayTraining.intensity}`
            : `${TRAINING_ACTIVITY_LABELS[autoActivity]} 일정이 오늘 자동 적용됩니다.`,
          tone: autoActivity === 'rest' ? 'neutral' : 'positive',
        });

        const affectedPlayers = userTeam.roster
          .map((player) => ({ player, effect: interventions.get(player.id) }))
          .filter((entry) => entry.effect);
        if (affectedPlayers.length > 0) {
          const strongest = affectedPlayers
            .sort((a, b) => ((b.effect?.moraleBonus ?? 0) + (b.effect?.formBonus ?? 0)) - ((a.effect?.moraleBonus ?? 0) + (a.effect?.formBonus ?? 0)))[0];
          items.push({
            title: '선수 면담 효과',
            detail: `${strongest.player.name} 선수가 ${strongest.effect?.topic ?? '최근 관리'} 영향으로 추가 효과를 받고 있습니다. 사기 ${strongest.effect?.moraleBonus ?? 0}, 폼 ${strongest.effect?.formBonus ?? 0}.`,
            tone: 'positive',
          });
        }

        if (recommendations.length > 0) {
          items.push({
            title: '스태프 리포트',
            detail: recommendations[0].summary,
            tone: recommendations[0].urgency === 'high' ? 'risk' : 'neutral',
          });
        }

        if (identity) {
          items.push({
            title: '감독 철학',
            detail: getManagerIdentitySummaryLine(identity),
            tone: 'neutral',
          });
        }

        setImpactSummary(items.slice(0, 4));
      } catch (error) {
        console.warn('[DayView] failed to build impact summary:', error);
        if (!cancelled) {
          setImpactSummary([]);
        }
      }
    };

    void loadImpactSummary();
    return () => {
      cancelled = true;
    };
  }, [autoActivity, save, season, todayTraining, userTeam]);

  const finalizeResult = useCallback(async (result: DayResult) => {
    setCurrentDate(result.nextDate);
    setDayType(result.dayType);
    const latestSeason = await getActiveSeason().catch(() => null);
    if (latestSeason) {
      setSeason(latestSeason);
    }
    usePlayerStore.getState().invalidateTeam(userTeamId);
    useTeamStore.getState().invalidateTeam(userTeamId);
  }, [setCurrentDate, setDayType, setSeason, userTeamId]);

  const handleAdvance = useCallback(async () => {
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
        undefined,
        save.id,
        useSettingsStore.getState().difficulty,
      );

      setDayResult(result);
      await finalizeResult(result);

      if (result.isSeasonEnd) {
        const latestSeason = await getActiveSeason().catch(() => null);
        setSeason(latestSeason ?? { ...season, currentDate: result.nextDate });
        setDayPhase('idle');
        navigate('/manager/season-end');
        return;
      }

      if (result.hasUserMatch && result.userMatch) {
        resetSeries();
        setFearlessPool({ blue: [], red: [] });
        setSeriesFearlessPool({ blue: [], red: [] });
        setHardFearlessSeries(result.userMatch.boFormat !== 'Bo1' || result.userMatch.hardFearlessSeries === true);
        setCurrentGameDraftRequired(true);
        setPendingUserMatch(result.userMatch);
        const latestSeason = await getActiveSeason().catch(() => null);
        setSeason(latestSeason ?? { ...season, currentDate: result.nextDate });
        setDayPhase('banpick');
        navigate('/manager/pre-match');
        return;
      }

      const latestSeason = await getActiveSeason().catch(() => null);
      setSeason(latestSeason ?? { ...season, currentDate: result.nextDate });
      setDayPhase('idle');
    } catch (error) {
      console.error('[DayView] advance failed:', error);
      setDayPhase('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [
    currentDate,
    finalizeResult,
    navigate,
    resetSeries,
    save,
    season,
    setDayPhase,
    setFearlessPool,
    setHardFearlessSeries,
    setCurrentGameDraftRequired,
    setPendingUserMatch,
    setSeriesFearlessPool,
    setSeason,
    userTeamId,
  ]);

  const handleSkip = useCallback(async () => {
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
        undefined,
        useSettingsStore.getState().difficulty,
      );

      setSkipResults(results);
      const lastResult = results.at(-1);
      if (!lastResult) {
        setDayPhase('idle');
        return;
      }

      await finalizeResult(lastResult);
      const latestSeason = await getActiveSeason().catch(() => null);
      setSeason(latestSeason ?? { ...season, currentDate: lastResult.nextDate });

      if (lastResult.isSeasonEnd) {
        setDayPhase('idle');
        navigate('/manager/season-end');
        return;
      }

      if (lastResult.hasUserMatch && lastResult.userMatch) {
        resetSeries();
        setFearlessPool({ blue: [], red: [] });
        setSeriesFearlessPool({ blue: [], red: [] });
        setHardFearlessSeries(lastResult.userMatch.boFormat !== 'Bo1' || lastResult.userMatch.hardFearlessSeries === true);
        setCurrentGameDraftRequired(true);
        setPendingUserMatch(lastResult.userMatch);
        setDayPhase('banpick');
        navigate('/manager/pre-match');
        return;
      }

      setDayPhase('idle');
    } catch (error) {
      console.error('[DayView] skip failed:', error);
      setDayPhase('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [
    currentDate,
    finalizeResult,
    navigate,
    resetSeries,
    save,
    season,
    setDayPhase,
    setFearlessPool,
    setHardFearlessSeries,
    setCurrentGameDraftRequired,
    setPendingUserMatch,
    setSeriesFearlessPool,
    setSeason,
    userTeamId,
  ]);

  const nextDayRef = useRef(handleAdvance);
  nextDayRef.current = handleAdvance;
  const processingRef = useRef(isProcessing);
  processingRef.current = isProcessing;

  useKeyboardShortcuts({
    onAdvanceDay: useCallback(() => {
      if (!processingRef.current) {
        void nextDayRef.current();
      }
    }, []),
  });

  const resultSummaryCards = useMemo(() => impactSummary.slice(0, 4), [impactSummary]);

  if (!season || !save || !userTeam) {
    return <p className="fm-text-muted fm-text-md">시즌 데이터를 불러오는 중입니다...</p>;
  }

  return (
    <div className="fm-animate-in">
      {isProcessing && (
        <div className="fm-overlay" style={{ zIndex: 50 }}>
          <div className="fm-modal" style={{ width: 360 }}>
            <div className="fm-modal__body fm-text-center">
              <h2 className="fm-text-xl fm-mb-sm">하루를 처리하는 중입니다</h2>
              <p className="fm-text-muted">일정, 이벤트, 경기 결과를 반영하고 있습니다. 잠시만 기다려 주세요.</p>
            </div>
          </div>
        </div>
      )}

      <div className="fm-page-header">
        <h1 className="fm-page-title">시즌 진행</h1>
      </div>

      <div className="dv-date-card">
        <div className="dv-date-main">
          <span className="fm-text-lg fm-text-muted">{currentDate}</span>
          <span className="dv-date-day">{DAY_NAMES[dayOfWeek]}요일</span>
        </div>
        <div className="dv-date-info">
          <span className="fm-badge fm-badge--default">{season.currentWeek}주차</span>
          <span className="fm-text-lg fm-font-semibold fm-text-accent">{userTeam.shortName}</span>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">오늘 적용될 일정</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            <div className="dv-focus-grid">
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">오늘의 활동</span>
                <span className="dv-focus-card__value">{TRAINING_ACTIVITY_LABELS[autoActivity]}</span>
                <p className="dv-focus-card__detail">하루 진행 버튼은 날짜만 넘깁니다. 실제 활동은 주간 훈련표에 저장된 계획이 자동으로 반영됩니다.</p>
              </div>
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">훈련 포커스</span>
                <span className="dv-focus-card__value">
                  {todayTraining ? TRAINING_TYPE_LABELS[todayTraining.trainingType] : '기본 훈련'}
                </span>
                <p className="dv-focus-card__detail">
                  {todayTraining ? `강도 ${todayTraining.intensity}` : '별도 설정이 없어서 기본 강도로 적용됩니다.'}
                </p>
              </div>
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">예상 변화</span>
                <span className="dv-focus-card__value">{DAY_TYPE_LABELS[autoActivity]}</span>
                <p className="dv-focus-card__detail">{getDecisionImpact(autoActivity, todayTraining)}</p>
              </div>
            </div>

            <p className="fm-text-muted">
              이제 시즌 진행 중에 훈련, 휴식, 스크림을 매일 고르지 않습니다. 주간 계획이 하루 운영을 자동으로 결정합니다.
            </p>

            <div className="fm-flex fm-gap-sm">
              <button className="fm-btn fm-btn--primary" onClick={() => void handleAdvance()} disabled={isProcessing}>
                하루 진행
              </button>
              <button className="fm-btn fm-btn--info" onClick={() => void handleSkip()} disabled={isProcessing}>
                다음 경기까지 건너뛰기
              </button>
              <button className="fm-btn" onClick={() => navigate('/manager/training')} disabled={isProcessing}>
                훈련 화면 열기
              </button>
            </div>
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">이번 주 영향 요약</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {impactSummary.length === 0 ? (
              <p className="fm-text-muted">최신 운영 영향 요약을 계산하고 있습니다.</p>
            ) : (
              <div className="dv-focus-grid">
                {impactSummary.map((item) => (
                  <div key={`${item.title}-${item.detail}`} className="dv-focus-card">
                    <span className="dv-focus-card__title">{item.title}</span>
                    <span className={`dv-focus-card__value ${getToneClass(item.tone)}`}>{item.tone === 'risk' ? '주의' : item.tone === 'positive' ? '상승' : '확인'}</span>
                    <p className="dv-focus-card__detail">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {dayResult && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">오늘 진행 결과</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-lg fm-mb-md">
              <div className="fm-stat">
                <span className="fm-stat__label">다음 날짜</span>
                <span className="fm-stat__value">{dayResult.nextDate}</span>
              </div>
              <div className="fm-stat">
                <span className="fm-stat__label">처리 유형</span>
                <span className="fm-stat__value">{DAY_TYPE_LABELS[dayResult.dayType] ?? dayResult.dayType}</span>
              </div>
            </div>

            <div className="dv-focus-grid fm-mb-md">
              {getResultHighlights(dayResult, todayTraining).map((highlight) => (
                <div key={highlight} className="dv-focus-card">
                  <span className="dv-focus-card__title">운영 피드백</span>
                  <span className="dv-focus-card__value">{highlight.split(':')[0]}</span>
                  <p className="dv-focus-card__detail">
                    {highlight.includes(':') ? highlight.split(':').slice(1).join(':').trim() : highlight}
                  </p>
                </div>
              ))}
            </div>

            <div className="fm-panel fm-mb-md" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="fm-panel__header">
                <span className="fm-panel__title">이번 주 흐름이 달라지는 이유</span>
              </div>
              <div className="fm-panel__body">
                <div className="dv-focus-grid">
                  {resultSummaryCards.map((item) => (
                    <div key={`result-${item.title}-${item.detail}`} className="dv-focus-card">
                      <span className="dv-focus-card__title">{item.title}</span>
                      <span className={`dv-focus-card__value ${getToneClass(item.tone)}`}>{item.tone === 'risk' ? '주의' : item.tone === 'positive' ? '상승' : '확인'}</span>
                      <p className="dv-focus-card__detail">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {dayResult.events.length === 0 ? (
              <p className="fm-text-muted">오늘은 기록된 특이 이벤트가 없습니다.</p>
            ) : (
              <div className="fm-flex-col fm-gap-sm">
                {dayResult.events.map((event, index) => (
                  <div key={`${event}-${index}`} className="fm-card">
                    <span className="fm-text-secondary">{event}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {skipResults.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">건너뛴 날짜 요약</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {skipResults.map((result) => (
              <div key={`${result.date}-${result.nextDate}`} className="fm-card">
                <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                  <span className="fm-text-primary fm-font-semibold">{result.date}</span>
                  <span className="fm-badge fm-badge--default">{DAY_TYPE_LABELS[result.dayType] ?? result.dayType}</span>
                </div>
                <p className="fm-text-muted" style={{ margin: 0 }}>
                  {result.events[0] ?? '큰 변화 없이 일정이 진행됐습니다.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
