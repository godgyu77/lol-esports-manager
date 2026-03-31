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

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAY_TYPE_LABELS: Record<DayType, string> = {
  match_day: 'Match day',
  training: 'Training',
  scrim: 'Scrim',
  rest: 'Rest',
  event: 'Event',
};

function getAutoActivity(entry: TrainingScheduleEntry | null): 'training' | 'scrim' | 'rest' {
  return entry?.activityType ?? 'training';
}

function getDecisionImpact(activity: DayType, training: TrainingScheduleEntry | null): string {
  if (activity === 'rest') return 'Recovery-focused day. Stamina and morale should stabilize before the next match.';
  if (activity === 'scrim') {
    return training
      ? `${TRAINING_TYPE_LABELS[training.trainingType]} focus will carry into today’s scrim feedback.`
      : 'Scrim reps will sharpen execution and expose weak points before matchday.';
  }
  if (activity === 'match_day') return 'Your recent preparation is about to show up in a real result.';
  return training
    ? `${TRAINING_TYPE_LABELS[training.trainingType]} training is the main growth lever for today.`
    : 'A standard training block will keep player condition and form moving.';
}

function getResultHighlights(result: DayResult, training: TrainingScheduleEntry | null): string[] {
  const highlights: string[] = [];

  if (result.dayType !== 'match_day') {
    highlights.push(`Applied schedule: ${DAY_TYPE_LABELS[result.dayType]}`);
  }

  if (training && result.dayType !== 'rest' && result.dayType !== 'match_day') {
    highlights.push(`Training focus: ${TRAINING_TYPE_LABELS[training.trainingType]} / ${training.intensity}`);
  }

  if (result.events.length > 0) {
    highlights.push(`Main update: ${result.events[0]}`);
  }

  if (highlights.length === 0) {
    highlights.push('No major surprises today. The schedule advanced as planned.');
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
          title: 'Weekly training',
          detail: todayTraining
            ? `${TRAINING_ACTIVITY_LABELS[autoActivity]} / ${TRAINING_TYPE_LABELS[todayTraining.trainingType]} / ${todayTraining.intensity}`
            : `${TRAINING_ACTIVITY_LABELS[autoActivity]} block is set to auto-apply today.`,
          tone: autoActivity === 'rest' ? 'neutral' : 'positive',
        });

        const affectedPlayers = userTeam.roster
          .map((player) => ({ player, effect: interventions.get(player.id) }))
          .filter((entry) => entry.effect);
        if (affectedPlayers.length > 0) {
          const strongest = affectedPlayers
            .sort((a, b) => ((b.effect?.moraleBonus ?? 0) + (b.effect?.formBonus ?? 0)) - ((a.effect?.moraleBonus ?? 0) + (a.effect?.formBonus ?? 0)))[0];
          items.push({
            title: 'Player meeting',
            detail: `${strongest.player.name} is still benefiting from ${strongest.effect?.topic ?? 'recent management'} (${strongest.effect?.moraleBonus ?? 0} morale / ${strongest.effect?.formBonus ?? 0} form).`,
            tone: 'positive',
          });
        }

        if (recommendations.length > 0) {
          items.push({
            title: 'Staff read',
            detail: recommendations[0].summary,
            tone: recommendations[0].urgency === 'high' ? 'risk' : 'neutral',
          });
        }

        if (identity) {
          items.push({
            title: 'Manager philosophy',
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
    setPendingUserMatch,
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
    setPendingUserMatch,
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
    return <p className="fm-text-muted fm-text-md">Loading season data...</p>;
  }

  return (
    <div className="fm-animate-in">
      {isProcessing && (
        <div className="fm-overlay" style={{ zIndex: 50 }}>
          <div className="fm-modal" style={{ width: 360 }}>
            <div className="fm-modal__body fm-text-center">
              <h2 className="fm-text-xl fm-mb-sm">Processing day</h2>
              <p className="fm-text-muted">Applying schedule, events, and match consequences. Please wait a moment.</p>
            </div>
          </div>
        </div>
      )}

      <div className="fm-page-header">
        <h1 className="fm-page-title">Season progression</h1>
      </div>

      <div className="dv-date-card">
        <div className="dv-date-main">
          <span className="fm-text-lg fm-text-muted">{currentDate}</span>
          <span className="dv-date-day">{DAY_NAMES[dayOfWeek]}</span>
        </div>
        <div className="dv-date-info">
          <span className="fm-badge fm-badge--default">Week {season.currentWeek}</span>
          <span className="fm-text-lg fm-font-semibold fm-text-accent">{userTeam.shortName}</span>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Auto-applied schedule</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            <div className="dv-focus-grid">
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">Today’s activity</span>
                <span className="dv-focus-card__value">{TRAINING_ACTIVITY_LABELS[autoActivity]}</span>
                <p className="dv-focus-card__detail">The season advance button only moves the date. Activity comes from your saved weekly plan.</p>
              </div>
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">Training focus</span>
                <span className="dv-focus-card__value">
                  {todayTraining ? TRAINING_TYPE_LABELS[todayTraining.trainingType] : 'Standard training'}
                </span>
                <p className="dv-focus-card__detail">
                  {todayTraining ? `Intensity ${todayTraining.intensity}` : 'Default intensity applies when no custom entry exists.'}
                </p>
              </div>
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">Expected impact</span>
                <span className="dv-focus-card__value">{DAY_TYPE_LABELS[autoActivity]}</span>
                <p className="dv-focus-card__detail">{getDecisionImpact(autoActivity, todayTraining)}</p>
              </div>
            </div>

            <p className="fm-text-muted">
              Training, rest, and scrims are no longer chosen while progressing the season. Your weekly setup drives the day automatically.
            </p>

            <div className="fm-flex fm-gap-sm">
              <button className="fm-btn fm-btn--primary" onClick={() => void handleAdvance()} disabled={isProcessing}>
                Advance one day
              </button>
              <button className="fm-btn fm-btn--info" onClick={() => void handleSkip()} disabled={isProcessing}>
                Skip to next match
              </button>
              <button className="fm-btn" onClick={() => navigate('/manager/training')} disabled={isProcessing}>
                Open training
              </button>
            </div>
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">This week’s impact summary</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {impactSummary.length === 0 ? (
              <p className="fm-text-muted">We are building the latest manager impact summary.</p>
            ) : (
              <div className="dv-focus-grid">
                {impactSummary.map((item) => (
                  <div key={`${item.title}-${item.detail}`} className="dv-focus-card">
                    <span className="dv-focus-card__title">{item.title}</span>
                    <span className={`dv-focus-card__value ${getToneClass(item.tone)}`}>{item.tone === 'risk' ? 'Risk' : item.tone === 'positive' ? 'Boost' : 'Read'}</span>
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
            <span className="fm-panel__title">Today’s outcome</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-gap-lg fm-mb-md">
              <div className="fm-stat">
                <span className="fm-stat__label">Next date</span>
                <span className="fm-stat__value">{dayResult.nextDate}</span>
              </div>
              <div className="fm-stat">
                <span className="fm-stat__label">Processed as</span>
                <span className="fm-stat__value">{DAY_TYPE_LABELS[dayResult.dayType] ?? dayResult.dayType}</span>
              </div>
            </div>

            <div className="dv-focus-grid fm-mb-md">
              {getResultHighlights(dayResult, todayTraining).map((highlight) => (
                <div key={highlight} className="dv-focus-card">
                  <span className="dv-focus-card__title">Decision feedback</span>
                  <span className="dv-focus-card__value">{highlight.split(':')[0]}</span>
                  <p className="dv-focus-card__detail">
                    {highlight.includes(':') ? highlight.split(':').slice(1).join(':').trim() : highlight}
                  </p>
                </div>
              ))}
            </div>

            <div className="fm-panel fm-mb-md" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="fm-panel__header">
                <span className="fm-panel__title">Why this week should feel different</span>
              </div>
              <div className="fm-panel__body">
                <div className="dv-focus-grid">
                  {resultSummaryCards.map((item) => (
                    <div key={`result-${item.title}-${item.detail}`} className="dv-focus-card">
                      <span className="dv-focus-card__title">{item.title}</span>
                      <span className={`dv-focus-card__value ${getToneClass(item.tone)}`}>{item.tone === 'risk' ? 'Risk' : item.tone === 'positive' ? 'Boost' : 'Read'}</span>
                      <p className="dv-focus-card__detail">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {dayResult.events.length === 0 ? (
              <p className="fm-text-muted">No special events were recorded today.</p>
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
            <span className="fm-panel__title">Skipped days summary</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {skipResults.map((result) => (
              <div key={`${result.date}-${result.nextDate}`} className="fm-card">
                <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                  <span className="fm-text-primary fm-font-semibold">{result.date}</span>
                  <span className="fm-badge fm-badge--default">{DAY_TYPE_LABELS[result.dayType] ?? result.dayType}</span>
                </div>
                <p className="fm-text-muted" style={{ margin: 0 }}>
                  {result.events[0] ?? 'No major update'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
