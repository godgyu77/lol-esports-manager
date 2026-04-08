import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { advanceDay, skipToNextMatchDay, type DayResult } from '../../../engine/season/dayAdvancer';
import type { DayType } from '../../../engine/season/calendar';
import { getActiveSeason } from '../../../db/queries';
import { getDatabase } from '../../../db/database';
import { getManagerIdentity, getManagerIdentitySummaryLine } from '../../../engine/manager/managerIdentityEngine';
import { getActiveInterventionEffects } from '../../../engine/manager/managerInterventionEngine';
import {
  applyCoachTacticsRecommendation,
  applyCoachTrainingRecommendation,
  generateInitialCoachRecommendations,
  getManagerSetupStatus,
  ManagerSetupBlockedError,
} from '../../../engine/manager/managerSetupEngine';
import {
  getActiveConsequences,
  getBudgetPressureSnapshot,
  getPrepRecommendationRecords,
} from '../../../engine/manager/systemDepthEngine';
import { getCareerArcEvents } from '../../../engine/manager/releaseDepthEngine';
import { generateStaffRecommendations } from '../../../engine/staff/staffEngine';
import { getTrainingSchedule } from '../../../engine/training/trainingEngine';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import { usePlayerStore } from '../../../stores/playerStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { useTeamStore } from '../../../stores/teamStore';
import type { CoachSetupRecommendation, ManagerSetupStatus } from '../../../types/managerSetup';
import type { BudgetPressureSnapshot, CareerArcEvent, OngoingConsequence, PrepRecommendationRecord } from '../../../types/systemDepth';
import { TRAINING_ACTIVITY_LABELS, TRAINING_TYPE_LABELS, type TrainingScheduleEntry } from '../../../types/training';
import { MainLoopPanel } from '../components/MainLoopPanel';
import './DayView.css';

type ImpactTone = 'positive' | 'risk' | 'neutral';

interface ImpactSummaryItem {
  title: string;
  detail: string;
  tone: ImpactTone;
}

interface NextMatchSummary {
  date: string;
  daysUntil: number;
  opponentName: string;
}

interface LoopPriorityAction {
  label: string;
  detail: string;
  tone: 'accent' | 'danger' | 'success';
  onClick: () => void;
  testId: string;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DAY_TYPE_LABELS: Record<DayType, string> = {
  match_day: '경기일',
  training: '훈련',
  scrim: '스크림',
  rest: '휴식',
  event: '이벤트',
};

function getAutoActivity(entry: TrainingScheduleEntry | null): 'training' | 'scrim' | 'rest' {
  return entry?.activityType ?? 'training';
}

function getResultHighlights(result: DayResult, training: TrainingScheduleEntry | null): string[] {
  const highlights: string[] = [];

  if (result.dayType !== 'match_day') {
    highlights.push(`진행 유형: ${DAY_TYPE_LABELS[result.dayType]}`);
  }
  if (training && result.dayType !== 'rest' && result.dayType !== 'match_day') {
    highlights.push(`훈련 초점: ${TRAINING_TYPE_LABELS[training.trainingType]} / 강도 ${training.intensity}`);
  }
  if (result.events.length > 0) {
    highlights.push(`오늘 변화: ${result.events[0]}`);
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

function getToneLabel(tone: ImpactTone): string {
  if (tone === 'positive') return '기회';
  if (tone === 'risk') return '리스크';
  return '메모';
}

function diffDays(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
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
  const [nextMatch, setNextMatch] = useState<NextMatchSummary | null>(null);
  const [budgetPressure, setBudgetPressure] = useState<BudgetPressureSnapshot | null>(null);
  const [consequences, setConsequences] = useState<OngoingConsequence[]>([]);
  const [prepRecords, setPrepRecords] = useState<PrepRecommendationRecord[]>([]);
  const [recentCareerArc, setRecentCareerArc] = useState<CareerArcEvent | null>(null);
  const [setupStatus, setSetupStatus] = useState<ManagerSetupStatus | null>(null);
  const [setupRecommendations, setSetupRecommendations] = useState<CoachSetupRecommendation[]>([]);
  const [setupMessage, setSetupMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const userTeamId = save?.userTeamId ?? '';
  const userTeam = teams.find((team) => team.id === userTeamId);
  const currentDate = season?.currentDate ?? '';
  const dateObj = currentDate ? new Date(currentDate.replace(/-/g, '/')) : new Date();
  const dayOfWeek = dateObj.getDay();
  const autoActivity = getAutoActivity(todayTraining);

  useEffect(() => {
    if (!save || !userTeamId) return;

    let cancelled = false;
    const loadSetup = async () => {
      try {
        const [status, recommendations] = await Promise.all([
          getManagerSetupStatus(userTeamId),
          generateInitialCoachRecommendations(userTeamId, save.currentSeasonId).catch(() => []),
        ]);
        if (cancelled) return;
        setSetupStatus(status);
        setSetupRecommendations(recommendations);
      } catch (error) {
        console.warn('[DayView] failed to load manager setup state:', error);
        if (!cancelled) {
          setSetupStatus(null);
          setSetupRecommendations([]);
        }
      }
    };

    void loadSetup();
    return () => {
      cancelled = true;
    };
  }, [save, userTeamId]);

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
    if (!season || !userTeamId) return;

    let cancelled = false;
    const loadNextMatch = async () => {
      try {
        const db = await getDatabase();
        const rows = await db.select<Array<{
          match_date: string;
          team_home_id: string;
          team_away_id: string;
          home_name: string;
          away_name: string;
        }>>(
          `SELECT
             m.match_date,
             m.team_home_id,
             m.team_away_id,
             th.short_name as home_name,
             ta.short_name as away_name
           FROM matches m
           JOIN teams th ON th.id = m.team_home_id
           JOIN teams ta ON ta.id = m.team_away_id
           WHERE m.season_id = $1
             AND m.is_played = 0
             AND m.match_date >= $2
             AND (m.team_home_id = $3 OR m.team_away_id = $3)
           ORDER BY m.match_date ASC
           LIMIT 1`,
          [season.id, season.currentDate, userTeamId],
        );
        if (cancelled) return;
        const row = rows[0];
        if (!row) {
          setNextMatch(null);
          return;
        }

        const opponentName = row.team_home_id === userTeamId ? row.away_name : row.home_name;
        setNextMatch({
          date: row.match_date,
          opponentName,
          daysUntil: diffDays(season.currentDate, row.match_date),
        });
      } catch (error) {
        console.warn('[DayView] failed to load next match summary:', error);
        if (!cancelled) setNextMatch(null);
      }
    };

    void loadNextMatch();
    return () => {
      cancelled = true;
    };
  }, [season, userTeamId]);

  useEffect(() => {
    if (!season || !save || !userTeam) return;

    let cancelled = false;
    const loadImpactSummary = async () => {
      try {
        const [identity, interventions, recommendations, pressure, activeConsequences, recentPrep, careerArcs] = await Promise.all([
          getManagerIdentity(save.id).catch(() => null),
          getActiveInterventionEffects(season.currentDate).catch(() => new Map()),
          generateStaffRecommendations(userTeam.id, season.id).catch(() => []),
          getBudgetPressureSnapshot(userTeam.id, season.id).catch(() => null),
          getActiveConsequences(userTeam.id, season.id, season.currentDate).catch(() => []),
          getPrepRecommendationRecords(userTeam.id, season.id, 2).catch(() => []),
          getCareerArcEvents(Number(save.id), userTeam.id, 1).catch(() => []),
        ]);

        if (cancelled) return;

        setBudgetPressure(pressure);
        setConsequences(activeConsequences);
        setPrepRecords(recentPrep);
        setRecentCareerArc(careerArcs[0] ?? null);

        const items: ImpactSummaryItem[] = [];

        items.push({
          title: '오늘의 핵심 일정',
          detail: todayTraining
            ? `${TRAINING_ACTIVITY_LABELS[autoActivity]} / ${TRAINING_TYPE_LABELS[todayTraining.trainingType]} / 강도 ${todayTraining.intensity}`
            : `${TRAINING_ACTIVITY_LABELS[autoActivity]} 중심으로 자동 진행됩니다.`,
          tone: autoActivity === 'rest' ? 'neutral' : 'positive',
        });

        const affectedPlayers = userTeam.roster
          .map((player) => ({ player, effect: interventions.get(player.id) }))
          .filter((entry) => entry.effect);
        if (affectedPlayers.length > 0) {
          const strongest = affectedPlayers.sort(
            (left, right) =>
              ((right.effect?.moraleBonus ?? 0) + (right.effect?.formBonus ?? 0)) -
              ((left.effect?.moraleBonus ?? 0) + (left.effect?.formBonus ?? 0)),
          )[0];
          items.push({
            title: '오늘의 긍정 효과',
            detail: `${strongest.player.name}에게 추가 보정이 들어갑니다. 사기 ${strongest.effect?.moraleBonus ?? 0}, 폼 ${strongest.effect?.formBonus ?? 0}.`,
            tone: 'positive',
          });
        }

        if (recommendations.length > 0) {
          items.push({
            title: '가장 큰 리스크',
            detail: recommendations[0].summary,
            tone: recommendations[0].urgency === 'high' ? 'risk' : 'neutral',
          });
        }

        if (identity) {
          items.push({
            title: '감독 철학 메모',
            detail: getManagerIdentitySummaryLine(identity),
            tone: 'neutral',
          });
        }

        setImpactSummary(items.slice(0, 4));
      } catch (error) {
        console.warn('[DayView] failed to build impact summary:', error);
        if (!cancelled) {
          setImpactSummary([]);
          setBudgetPressure(null);
          setConsequences([]);
          setPrepRecords([]);
          setRecentCareerArc(null);
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
    if (latestSeason) setSeason(latestSeason);
    usePlayerStore.getState().invalidateTeam(userTeamId);
    useTeamStore.getState().invalidateTeam(userTeamId);
  }, [setCurrentDate, setDayType, setSeason, userTeamId]);

  const refreshSetupState = useCallback(async () => {
    if (!save || !userTeamId) return;

    const [status, recommendations, schedule] = await Promise.all([
      getManagerSetupStatus(userTeamId),
      generateInitialCoachRecommendations(userTeamId, save.currentSeasonId).catch(() => []),
      getTrainingSchedule(userTeamId),
    ]);

    const todayEntry = schedule.find((entry) => entry.dayOfWeek === dayOfWeek) ?? null;
    setTodayTraining(todayEntry);
    setSetupStatus(status);
    setSetupRecommendations(recommendations);
  }, [dayOfWeek, save, userTeamId]);

  const handleApplyTrainingRecommendation = useCallback(async () => {
    const recommendation = setupRecommendations.find((item) => item.kind === 'training');
    if (!recommendation) return;

    try {
      await applyCoachTrainingRecommendation(userTeamId, recommendation);
      setSetupMessage({ text: '코치 추천 훈련안을 적용했습니다.', type: 'success' });
      await refreshSetupState();
    } catch (error) {
      console.error('[DayView] failed to apply training recommendation:', error);
      setSetupMessage({ text: '코치 추천 훈련안 적용에 실패했습니다.', type: 'error' });
    }
  }, [refreshSetupState, setupRecommendations, userTeamId]);

  const handleApplyTacticsRecommendation = useCallback(async () => {
    const recommendation = setupRecommendations.find((item) => item.kind === 'tactics');
    if (!recommendation) return;

    try {
      await applyCoachTacticsRecommendation(userTeamId, recommendation);
      setSetupMessage({ text: '코치 추천 전술안을 적용했습니다.', type: 'success' });
      await refreshSetupState();
    } catch (error) {
      console.error('[DayView] failed to apply tactics recommendation:', error);
      setSetupMessage({ text: '코치 추천 전술안 적용에 실패했습니다.', type: 'error' });
    }
  }, [refreshSetupState, setupRecommendations, userTeamId]);

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
      if (error instanceof ManagerSetupBlockedError) {
        setSetupStatus(error.status);
        setSetupMessage({ text: error.status.blockingReasons[0] ?? '운영 세팅을 먼저 완료해야 합니다.', type: 'error' });
      } else {
        console.error('[DayView] advance failed:', error);
      }
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
    setCurrentGameDraftRequired,
    setDayPhase,
    setFearlessPool,
    setHardFearlessSeries,
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
      if (error instanceof ManagerSetupBlockedError) {
        setSetupStatus(error.status);
        setSetupMessage({ text: error.status.blockingReasons[0] ?? '운영 세팅을 먼저 완료해야 합니다.', type: 'error' });
      } else {
        console.error('[DayView] skip failed:', error);
      }
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
    setCurrentGameDraftRequired,
    setDayPhase,
    setFearlessPool,
    setHardFearlessSeries,
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

  const resultSummaryCards = useMemo(() => impactSummary.slice(0, 3), [impactSummary]);
  const primaryRisk = impactSummary.find((item) => item.tone === 'risk') ?? impactSummary[2] ?? null;
  const isSetupReady = setupStatus?.isReadyToAdvance ?? false;
  const trainingRecommendation = setupRecommendations.find((item) => item.kind === 'training') ?? null;
  const tacticsRecommendation = setupRecommendations.find((item) => item.kind === 'tactics') ?? null;
  const coachAdvice = trainingRecommendation ?? tacticsRecommendation ?? null;
  const topConsequence = consequences[0] ?? null;
  const latestPrepRecord = prepRecords[0] ?? null;
  const budgetIsUrgent = budgetPressure?.pressureLevel === 'critical' || budgetPressure?.pressureLevel === 'watch';

  const primaryLoopAction = useMemo<LoopPriorityAction>(() => {
    if (!isSetupReady) {
      if (!setupStatus?.isTrainingConfigured) {
        return {
          label: '훈련 세팅 마무리',
          detail: '오늘 루프를 진행하기 전에 이번 주 훈련 계획부터 확정해야 합니다.',
          tone: 'danger',
          onClick: () => navigate('/manager/training'),
          testId: 'dayview-primary-setup-training',
        };
      }
      if (!setupStatus?.isTacticsConfigured) {
        return {
          label: '전술 세팅 마무리',
          detail: '전술이 비어 있으면 오늘 준비와 다음 경기 메시지가 흔들립니다.',
          tone: 'danger',
          onClick: () => navigate('/manager/tactics'),
          testId: 'dayview-primary-setup-tactics',
        };
      }
    }

    if (budgetPressure && budgetIsUrgent) {
      return {
        label: '재정 압박 점검',
        detail: budgetPressure.boardPressureNote,
        tone: 'danger',
        onClick: () => navigate('/manager/finance'),
        testId: 'dayview-primary-budget',
      };
    }

    if (topConsequence) {
      return {
        label: topConsequence.consequenceType === 'budget' ? '후폭풍 관리' : '운영 후폭풍 확인',
        detail: topConsequence.summary,
        tone: topConsequence.severity === 'high' ? 'danger' : 'accent',
        onClick: () => navigate(topConsequence.consequenceType === 'budget' ? '/manager/finance' : '/manager/news'),
        testId: 'dayview-primary-consequence',
      };
    }

    if (latestPrepRecord && nextMatch) {
      return {
        label: latestPrepRecord.focusArea === 'tactics' ? '다음 경기 전술 점검' : '다음 경기 준비 점검',
        detail: latestPrepRecord.impactSummary ?? latestPrepRecord.summary,
        tone: latestPrepRecord.observedOutcome === 'positive' ? 'success' : 'accent',
        onClick: () => navigate(latestPrepRecord.focusArea === 'tactics' ? '/manager/tactics' : '/manager/training'),
        testId: 'dayview-primary-prep',
      };
    }

    return {
      label: '오늘 일정 진행',
      detail: '당장 리스크가 정리됐으면 오늘 일정을 진행해 다음 경기와 결과를 확인합니다.',
      tone: 'success',
      onClick: () => void handleAdvance(),
      testId: 'dayview-primary-advance',
    };
  }, [budgetIsUrgent, budgetPressure, handleAdvance, isSetupReady, latestPrepRecord, navigate, nextMatch, setupStatus, topConsequence]);

  const loopWarning = useMemo(() => {
    if (!isSetupReady) {
      return '세팅이 비어 있는 상태에서 하루를 넘기면 준비 완성도가 크게 떨어집니다.';
    }
    if (budgetPressure?.pressureLevel === 'critical') {
      return `지금은 예산 활주로가 ${budgetPressure.runwayWeeks.toFixed(1)}주 수준이라 추가 지출이 바로 시즌 운영 압박으로 이어집니다.`;
    }
    if (budgetPressure?.pressureLevel === 'watch') {
      return '협상 비용과 고정 지출이 누적되고 있습니다. 보드는 현재 지출 패턴을 주시하고 있습니다.';
    }
    if (topConsequence) {
      return `${topConsequence.title}: ${topConsequence.summary}`;
    }
    if (latestPrepRecord) {
      return latestPrepRecord.impactSummary ?? latestPrepRecord.summary;
    }
    return '큰 경고는 없지만, 지금 내린 작은 결정들이 다음 경기와 시즌 흐름을 바꿀 수 있습니다.';
  }, [budgetPressure, isSetupReady, latestPrepRecord, topConsequence]);

  if (!season || !save || !userTeam) {
    return <p className="fm-text-muted fm-text-md">시즌 데이터를 불러오는 중입니다...</p>;
  }

  return (
    <div className="fm-animate-in">
      {isProcessing && (
        <div className="fm-overlay" style={{ zIndex: 50 }}>
          <div className="fm-modal" style={{ width: 360 }}>
            <div className="fm-modal__body fm-text-center">
              <h2 className="fm-text-xl fm-mb-sm">일정을 처리하는 중입니다</h2>
              <p className="fm-text-muted">하루 일정과 경기 결과를 반영하고 있습니다. 잠시만 기다려 주세요.</p>
            </div>
          </div>
        </div>
      )}

      <div className="fm-page-header">
        <h1 className="fm-page-title">시즌 진행</h1>
      </div>

      <MainLoopPanel
        eyebrow="시즌 루프"
        title="지금 해야 할 일과 다음 경기, 위험 요소를 첫 화면에서 바로 읽을 수 있게 정리했습니다."
        subtitle="이 화면은 날짜를 넘기는 버튼만 누르는 곳이 아니라, 오늘 처리할 운영 판단을 빠르게 끝내는 메인 허브입니다."
        insights={[
          {
            label: '현재 상태',
            value: nextMatch ? `${nextMatch.daysUntil}일 뒤 경기` : '일정 확인 단계',
            detail: nextMatch ? `${nextMatch.date} vs ${nextMatch.opponentName}` : '가까운 경기 일정이 잡히면 여기서 바로 준비 흐름으로 이어집니다.',
            tone: 'accent',
          },
          {
            label: '즉시 해야 할 일',
            value: primaryLoopAction.label,
            detail: primaryLoopAction.detail,
            tone: primaryLoopAction.tone,
          },
          {
            label: '가장 큰 위험',
            value: budgetIsUrgent ? '재정 압박' : topConsequence?.title ?? '안정',
            detail: budgetIsUrgent
              ? `${budgetPressure?.topDrivers[0] ?? ''} ${budgetPressure?.boardPressureNote ?? ''}`.trim()
              : topConsequence?.summary ?? '즉시 개입이 필요한 리스크는 보이지 않습니다.',
            tone: budgetIsUrgent || topConsequence?.severity === 'high' ? 'danger' : 'success',
          },
        ]}
        actions={[
          { label: primaryLoopAction.label, onClick: primaryLoopAction.onClick, variant: 'primary', disabled: isProcessing },
          { label: '훈련 보기', onClick: () => navigate('/manager/training') },
          { label: '뉴스 보기', onClick: () => navigate('/manager/news'), variant: 'info' },
        ]}
        note="누적 콘텐츠는 뉴스에서 스크롤로 읽고, 이 화면은 오늘의 결정과 이동 동선을 한눈에 보는 데 집중합니다."
      />

      {setupStatus && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">{isSetupReady ? '이번 주 코치 브리핑' : '코치 브리핑 진행 전 필수 세팅'}</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {setupMessage && (
              <div className={`fm-alert ${setupMessage.type === 'success' ? 'fm-alert--success' : 'fm-alert--danger'}`}>
                <span className="fm-alert__text">{setupMessage.text}</span>
              </div>
            )}

            {!isSetupReady && (
              <div className="fm-alert fm-alert--warning">
                <span className="fm-alert__text">
                  {setupStatus.blockingReasons.join(' ')} 훈련과 전술을 확정하기 전에는 일정 진행이 제한됩니다.
                </span>
              </div>
            )}

            <div className="dv-focus-grid">
              {trainingRecommendation && (
                <div className="dv-focus-card">
                  <span className="dv-focus-card__title">훈련 제안</span>
                  <span className="dv-focus-card__value">{trainingRecommendation.authorName}</span>
                  <p className="dv-focus-card__detail">{trainingRecommendation.headline}</p>
                  <p className="fm-text-xs fm-text-secondary">{trainingRecommendation.reasons.join(' ')}</p>
                  {!setupStatus.isTrainingConfigured && (
                    <button className="fm-btn fm-btn--primary fm-btn--sm" onClick={() => void handleApplyTrainingRecommendation()}>
                      훈련 추천 적용
                    </button>
                  )}
                </div>
              )}

              {tacticsRecommendation && (
                <div className="dv-focus-card">
                  <span className="dv-focus-card__title">전술 제안</span>
                  <span className="dv-focus-card__value">{tacticsRecommendation.authorName}</span>
                  <p className="dv-focus-card__detail">{tacticsRecommendation.headline}</p>
                  <p className="fm-text-xs fm-text-secondary">{tacticsRecommendation.reasons.join(' ')}</p>
                  {!setupStatus.isTacticsConfigured && (
                    <button className="fm-btn fm-btn--primary fm-btn--sm" onClick={() => void handleApplyTacticsRecommendation()}>
                      전술 추천 적용
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="fm-flex fm-gap-sm fm-flex-wrap">
              {!setupStatus.isTrainingConfigured && (
                <button className="fm-btn" onClick={() => navigate('/manager/training')}>
                  훈련 직접 설정
                </button>
              )}
              {!setupStatus.isTacticsConfigured && (
                <button className="fm-btn" onClick={() => navigate('/manager/tactics')}>
                  전술 직접 설정
                </button>
              )}
              <button className="fm-btn fm-btn--info" onClick={() => navigate('/manager/news')}>
                뉴스에서 브리핑 보기
              </button>
            </div>
          </div>
        </div>
      )}

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
            <span className="fm-panel__title">운영 우선순위</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            <div className="dv-focus-grid">
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">1순위 액션</span>
                <span className={`dv-focus-card__value ${primaryLoopAction.tone === 'danger' ? 'fm-text-danger' : primaryLoopAction.tone === 'success' ? 'fm-text-success' : 'fm-text-accent'}`}>
                  {primaryLoopAction.label}
                </span>
                <p className="dv-focus-card__detail">{primaryLoopAction.detail}</p>
              </div>
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">가장 큰 리스크</span>
                <span className={`dv-focus-card__value ${budgetIsUrgent || topConsequence?.severity === 'high' ? 'fm-text-danger' : 'fm-text-accent'}`}>
                  {budgetIsUrgent ? '재정 압박' : topConsequence?.title ?? '안정'}
                </span>
                <p className="dv-focus-card__detail">
                  {budgetIsUrgent ? `${budgetPressure?.topDrivers[0] ?? ''} ${budgetPressure?.boardPressureNote ?? ''}`.trim() : topConsequence?.summary ?? (primaryRisk?.detail ?? '즉시 개입이 필요한 리스크는 아직 보이지 않습니다.')}
                </p>
              </div>
              <div className="dv-focus-card">
                <span className="dv-focus-card__title">지금 팀 서사</span>
                <span className={`dv-focus-card__value ${recentCareerArc?.arcType === 'collapse' ? 'fm-text-danger' : recentCareerArc?.arcType === 'dynasty' ? 'fm-text-success' : 'fm-text-accent'}`}>
                  {recentCareerArc?.headline ?? '이번 시즌 축 형성 중'}
                </span>
                <p className="dv-focus-card__detail">
                  {recentCareerArc?.summary ?? (coachAdvice?.headline ?? '경기 결과와 운영 선택이 하나의 시즌 이야기로 연결되기 시작합니다.')}
                </p>
              </div>
            </div>

            <div className="fm-flex fm-gap-sm fm-flex-wrap">
              <button
                className="fm-btn fm-btn--primary"
                onClick={primaryLoopAction.onClick}
                disabled={isProcessing}
                data-testid={primaryLoopAction.testId}
              >
                {primaryLoopAction.label}
              </button>
              <button
                className="fm-btn fm-btn--info"
                onClick={() => void handleSkip()}
                disabled={isProcessing || !isSetupReady}
                aria-label="다음 경기까지 자동 진행"
                data-testid="dayview-skip-action"
              >
                다음 경기까지 자동 진행
              </button>
              <button className="fm-btn" onClick={() => navigate('/manager/training')} disabled={isProcessing}>
                주간 훈련 수정
              </button>
            </div>

            <div className="fm-alert fm-alert--warning">
              <span className="fm-alert__text">{loopWarning}</span>
            </div>
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">이번 주 영향 요약</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {impactSummary.length === 0 ? (
              <p className="fm-text-muted">최신 운영 영향 요약을 계산하는 중입니다.</p>
            ) : (
              <div className="dv-focus-grid">
                {impactSummary.map((item) => (
                  <div key={`${item.title}-${item.detail}`} className="dv-focus-card">
                    <span className="dv-focus-card__title">{item.title}</span>
                    <span className={`dv-focus-card__value ${getToneClass(item.tone)}`}>{getToneLabel(item.tone)}</span>
                    <p className="dv-focus-card__detail">{item.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {(recentCareerArc || coachAdvice || topConsequence || latestPrepRecord) ? (
        <details className="fm-disclosure fm-mb-lg">
          <summary>배경 메모 더 보기</summary>
          <div className="fm-disclosure__body">
            <div className="fm-grid fm-grid--2">
              {recentCareerArc ? (
                <div className="fm-panel" data-testid="dayview-career-arc-card">
                  <div className="fm-panel__header">
                    <span className="fm-panel__title">시즌 서사</span>
                  </div>
                  <div className="fm-panel__body fm-flex-col fm-gap-sm">
                    <div className="fm-flex fm-items-center fm-justify-between fm-gap-sm">
                      <strong className="fm-text-primary">{recentCareerArc.headline}</strong>
                      <span className="fm-badge fm-badge--info">{recentCareerArc.stage}</span>
                    </div>
                    <p className="fm-text-secondary" style={{ margin: 0 }}>{recentCareerArc.summary}</p>
                  </div>
                </div>
              ) : null}

              {(coachAdvice || topConsequence || latestPrepRecord) ? (
                <div className="fm-panel">
                  <div className="fm-panel__header">
                    <span className="fm-panel__title">세부 배경</span>
                  </div>
                  <div className="fm-panel__body fm-flex-col fm-gap-sm">
                    {coachAdvice ? (
                      <div className="fm-card">
                        <div className="fm-text-primary fm-font-semibold fm-mb-xs">코치 메모</div>
                        <div className="fm-text-secondary">{coachAdvice.headline}</div>
                      </div>
                    ) : null}
                    {topConsequence ? (
                      <div className="fm-card">
                        <div className="fm-text-primary fm-font-semibold fm-mb-xs">{topConsequence.title}</div>
                        <div className="fm-text-secondary">{topConsequence.summary}</div>
                      </div>
                    ) : null}
                    {latestPrepRecord ? (
                      <div className="fm-card">
                        <div className="fm-text-primary fm-font-semibold fm-mb-xs">최근 준비 효과</div>
                        <div className="fm-text-secondary">{latestPrepRecord.impactSummary ?? latestPrepRecord.summary}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </details>
      ) : null}

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
                  <span className="dv-focus-card__title">무엇이 달라졌나</span>
                  <span className="dv-focus-card__value">{highlight.split(':')[0]}</span>
                  <p className="dv-focus-card__detail">
                    {highlight.includes(':') ? highlight.split(':').slice(1).join(':').trim() : highlight}
                  </p>
                </div>
              ))}
            </div>

            {resultSummaryCards.length > 0 ? (
              <details className="fm-disclosure fm-mb-md">
                <summary>오늘 결과를 만든 배경 보기</summary>
                <div className="fm-disclosure__body">
                  <div className="dv-focus-grid">
                    {resultSummaryCards.map((item) => (
                      <div key={`result-${item.title}-${item.detail}`} className="dv-focus-card">
                        <span className="dv-focus-card__title">{item.title}</span>
                        <span className={`dv-focus-card__value ${getToneClass(item.tone)}`}>{getToneLabel(item.tone)}</span>
                        <p className="dv-focus-card__detail">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}

            {dayResult.events.length === 0 ? (
              <p className="fm-text-muted">오늘 기록할 만한 별도 이벤트는 없었습니다.</p>
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
        <details className="fm-disclosure">
          <summary>자동 진행 요약 보기</summary>
          <div className="fm-disclosure__body">
            <div className="fm-flex-col fm-gap-sm">
              {skipResults.map((result) => (
                <div key={`${result.date}-${result.nextDate}`} className="fm-card">
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                    <span className="fm-text-primary fm-font-semibold">{result.date}</span>
                    <span className="fm-badge fm-badge--default">{DAY_TYPE_LABELS[result.dayType] ?? result.dayType}</span>
                  </div>
                  <p className="fm-text-muted" style={{ margin: 0 }}>
                    {result.events[0] ?? '큰 변수 없이 일정이 진행됐습니다.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
