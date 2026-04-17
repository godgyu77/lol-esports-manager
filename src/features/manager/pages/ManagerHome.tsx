import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMatchesByTeam } from '../../../db/queries';
import { getBoardExpectations } from '../../../engine/board/boardEngine';
import { getInboxMessages } from '../../../engine/inbox/inboxEngine';
import { getMainLoopRiskItems, getBudgetPressureSnapshot } from '../../../engine/manager/systemDepthEngine';
import { getUnreadCount } from '../../../engine/news/newsEngine';
import { useBgm } from '../../../hooks/useBgm';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { formatAmount } from '../../../utils/formatUtils';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MainLoopPanel } from '../components/MainLoopPanel';
import { getLoopRiskRoute } from '../utils/loopRiskRouting';
import './ManagerHome.css';

interface NextMatchSummary {
  id: number | string;
  date: string;
  opponentName: string;
  boFormat: string;
  match: {
    id: number | string;
    boFormat: string;
    hardFearlessSeries?: boolean;
  } & Record<string, unknown>;
}

interface MatchFollowUpSummary {
  title: string;
  summary: string;
  actionRoute: string | null;
}

interface LoopRiskSummary {
  title: string;
  summary: string;
  route: string;
}

function diffDays(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

export function ManagerHome() {
  useBgm('game');

  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const setDayPhase = useGameStore((s) => s.setDayPhase);
  const setPendingUserMatch = useGameStore((s) => s.setPendingUserMatch);
  const tutorialComplete = useSettingsStore((s) => s.tutorialComplete);
  const resetSeries = useMatchStore((s) => s.resetSeries);
  const setBoFormat = useMatchStore((s) => s.setBoFormat);
  const setHardFearlessSeries = useMatchStore((s) => s.setHardFearlessSeries);
  const setCurrentGameDraftRequired = useMatchStore((s) => s.setCurrentGameDraftRequired);
  const setSeriesFearlessPool = useMatchStore((s) => s.setSeriesFearlessPool);
  const userTeam = teams.find((team) => team.id === save?.userTeamId);

  const [loading, setLoading] = useState(true);
  const [nextMatch, setNextMatch] = useState<NextMatchSummary | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [boardSatisfaction, setBoardSatisfaction] = useState<number | null>(null);
  const [budgetPressure, setBudgetPressure] = useState<Awaited<ReturnType<typeof getBudgetPressureSnapshot>>>(null);
  const [topLoopRisk, setTopLoopRisk] = useState<LoopRiskSummary | null>(null);
  const [featuredMatchFollowUp, setFeaturedMatchFollowUp] = useState<MatchFollowUpSummary | null>(null);

  const openMatchPrep = useCallback((match: NextMatchSummary['match']) => {
    setPendingUserMatch(match as never);
    setDayPhase('banpick');
    resetSeries();
    setBoFormat(match.boFormat);
    setHardFearlessSeries(Boolean(match.hardFearlessSeries));
    setCurrentGameDraftRequired(true);
    setSeriesFearlessPool({ blue: [], red: [] });
    navigate('/manager/pre-match');
  }, [
    navigate,
    resetSeries,
    setBoFormat,
    setCurrentGameDraftRequired,
    setDayPhase,
    setHardFearlessSeries,
    setPendingUserMatch,
    setSeriesFearlessPool,
  ]);

  useEffect(() => {
    if (!season || !userTeam || !save) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [matches, unread, board, pressure, risks, inboxMessages] = await Promise.all([
          getMatchesByTeam(season.id, userTeam.id).catch(() => []),
          getUnreadCount(season.id).catch(() => 0),
          getBoardExpectations(userTeam.id, season.id).catch(() => null),
          getBudgetPressureSnapshot(userTeam.id, season.id).catch(() => null),
          getMainLoopRiskItems(userTeam.id, season.id, season.currentDate, save.id).catch(() => []),
          getInboxMessages(userTeam.id, 12, false).catch(() => []),
        ]);

        if (cancelled) return;

        const upcoming = matches
          .filter((match) => !match.isPlayed)
          .sort((left, right) => (left.matchDate ?? '').localeCompare(right.matchDate ?? ''))[0];
        if (upcoming) {
          const opponentId = upcoming.teamHomeId === userTeam.id ? upcoming.teamAwayId : upcoming.teamHomeId;
          const opponent = teams.find((team) => team.id === opponentId);
          setNextMatch({
            id: upcoming.id,
            date: upcoming.matchDate ?? season.currentDate,
            opponentName: opponent?.name ?? '상대 미정',
            boFormat: upcoming.boFormat,
            match: upcoming,
          });
        } else {
          setNextMatch(null);
        }

        setUnreadCount(unread);
        setBoardSatisfaction(board?.satisfaction ?? null);
        setBudgetPressure(pressure);
        const risk = risks[0] ?? null;
        setTopLoopRisk(
          risk
            ? {
                title: risk.title,
                summary: risk.summary,
                route: getLoopRiskRoute(risk.title, risk.summary),
              }
            : null,
        );

        const latestMatchFollowUp =
          inboxMessages.find((message) => message.relatedId?.startsWith('match_result:') || message.title.startsWith('[경기 결과]')) ?? null;
        setFeaturedMatchFollowUp(
          latestMatchFollowUp
            ? {
                title: latestMatchFollowUp.title,
                summary: latestMatchFollowUp.content,
                actionRoute: latestMatchFollowUp.actionRoute,
              }
            : null,
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [save, season, teams, userTeam]);

  const primaryAction = useMemo(() => {
    if (featuredMatchFollowUp) {
      return {
        label: '방금 경기 정리',
        detail: featuredMatchFollowUp.summary,
        onClick: () => navigate(featuredMatchFollowUp.actionRoute ?? '/manager/inbox'),
      };
    }

    if (topLoopRisk) {
      return {
        label: topLoopRisk.title,
        detail: topLoopRisk.summary,
        onClick: () => navigate(topLoopRisk.route),
      };
    }

    if (nextMatch) {
      return {
        label: `${nextMatch.opponentName}전 준비`,
        detail: `${nextMatch.date} / ${nextMatch.boFormat}`,
        onClick: () => openMatchPrep(nextMatch.match),
      };
    }

    return {
      label: '시즌 진행',
      detail: '뉴스를 먼저 확인한 뒤 다음 일정으로 넘어가세요.',
      onClick: () => navigate('/manager/day'),
    };
  }, [featuredMatchFollowUp, navigate, nextMatch, openMatchPrep, topLoopRisk]);

  const spotlight = useMemo(() => {
    if (featuredMatchFollowUp) {
      return {
        title: '뉴스에서 후속 조치 확인',
        summary: '방금 경기 결과와 다음 액션을 뉴스룸에서 바로 읽을 수 있게 정리했습니다.',
        route: '/manager/news',
        cta: '뉴스 열기',
      };
    }

    if (nextMatch) {
      return {
        title: `${nextMatch.opponentName}전 흐름 미리 보기`,
        summary: '경기 전에 상대, 일정, 준비 상태를 한 번에 확인할 수 있습니다.',
        route: '/manager/day',
        cta: '준비 흐름 보기',
      };
    }

    return {
      title: '오늘 팀 분위기 둘러보기',
      summary: '급한 일만 처리하지 말고 뉴스와 인박스를 먼저 훑으면 흐름을 놓치지 않습니다.',
      route: '/manager/news',
      cta: '브리핑 보기',
    };
  }, [featuredMatchFollowUp, nextMatch]);

  const daysUntilMatch = nextMatch && season ? diffDays(season.currentDate, nextMatch.date) : null;

  if (!season || !userTeam) {
    return <p className="fm-text-muted">시즌 데이터를 불러오는 중입니다...</p>;
  }

  return (
    <div className="fm-animate-in">
      {!tutorialComplete ? <TutorialOverlay /> : null}

      <div className="fm-page-header">
        <h1 className="fm-page-title">매니저 홈</h1>
        <p className="fm-page-subtitle">오늘 해야 할 일, 다음 경기, 뉴스 흐름을 한눈에 정리했습니다.</p>
      </div>

      <div className="fm-grid fm-grid--3 fm-mb-lg" data-testid="managerhome-priority-strip">
        <button type="button" className="fm-card fm-text-left" onClick={primaryAction.onClick}>
          <div className="fm-text-xs fm-text-muted fm-mb-xs">오늘 할 일</div>
          <div className="fm-text-primary fm-font-semibold fm-mb-xs">{primaryAction.label}</div>
          <div className="fm-text-secondary">{primaryAction.detail}</div>
        </button>
        <button
          type="button"
          className="fm-card fm-text-left"
          onClick={() => (nextMatch ? openMatchPrep(nextMatch.match) : navigate('/manager/day'))}
        >
          <div className="fm-text-xs fm-text-muted fm-mb-xs">다음 경기</div>
          <div className="fm-text-primary fm-font-semibold fm-mb-xs">
            {nextMatch ? `${nextMatch.opponentName}` : '일정 확인'}
          </div>
          <div className="fm-text-secondary">
            {nextMatch ? `${nextMatch.date} / ${nextMatch.boFormat}` : '예정된 경기가 없으면 시즌 진행 화면으로 이동합니다.'}
          </div>
        </button>
        <button
          type="button"
          className="fm-card fm-text-left"
          onClick={() => navigate(topLoopRisk?.route ?? '/manager/finance')}
        >
          <div className="fm-text-xs fm-text-muted fm-mb-xs">운영 리스크</div>
          <div className="fm-text-primary fm-font-semibold fm-mb-xs">{topLoopRisk?.title ?? '안정'}</div>
          <div className="fm-text-secondary">
            {topLoopRisk?.summary ?? budgetPressure?.topDrivers?.[0] ?? '급한 운영 경고는 아직 없습니다.'}
          </div>
        </button>
      </div>

      <MainLoopPanel
        eyebrow="FM형 루프"
        title="뉴스를 읽고, 필요한 조치를 끝낸 뒤, Next로 진행하는 구조로 정리했습니다."
        subtitle={loading ? '오늘 데이터를 읽는 중입니다.' : '필수 액션은 위 카드와 뉴스룸에서 먼저 확인할 수 있습니다.'}
        insights={[
          {
            label: '오늘 1순위',
            value: primaryAction.label,
            detail: primaryAction.detail,
            tone: featuredMatchFollowUp || topLoopRisk ? 'danger' : 'accent',
          },
          {
            label: '다음 경기',
            value: nextMatch ? `${daysUntilMatch}일 뒤` : '일정 없음',
            detail: nextMatch ? `${nextMatch.date} vs ${nextMatch.opponentName}` : '현재는 바로 시즌 진행이 가능합니다.',
            tone: nextMatch ? 'accent' : 'neutral',
          },
          {
            label: '뉴스 상태',
            value: unreadCount > 0 ? `${unreadCount}건 미확인` : '읽을 거리 정리됨',
            detail: unreadCount > 0 ? '뉴스룸에서 필수 기사와 일반 기사를 함께 확인하세요.' : '지금은 새로운 브리핑이 많지 않습니다.',
            tone: unreadCount > 0 ? 'warning' : 'success',
          },
          {
            label: '클럽 상태',
            value: boardSatisfaction != null ? `${boardSatisfaction}/100` : '집계 중',
            detail: budgetPressure?.topDrivers?.[0] ?? `${userTeam.name} 예산 ${formatAmount(userTeam.budget)}`,
            tone: boardSatisfaction != null && boardSatisfaction < 50 ? 'danger' : 'success',
          },
        ]}
        actions={[
          { label: '뉴스 보기', onClick: () => navigate('/manager/news'), variant: 'primary' },
          { label: 'Next', onClick: () => navigate('/manager/day'), variant: 'info' },
          { label: '전술', onClick: () => navigate('/manager/tactics') },
        ]}
      />

      <div className="fm-panel" data-testid="managerhome-spotlight-panel">
        <div className="fm-panel__header">
          <span className="fm-panel__title">오늘 가장 먼저 읽을 것</span>
        </div>
        <div className="fm-panel__body">
          <button type="button" className="fm-card fm-text-left" onClick={() => navigate(spotlight.route)}>
            <div className="fm-text-primary fm-font-semibold fm-mb-xs">{spotlight.title}</div>
            <div className="fm-text-secondary fm-mb-sm">{spotlight.summary}</div>
            <div className="fm-text-xs fm-text-accent">{spotlight.cta}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
