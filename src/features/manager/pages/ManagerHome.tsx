import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateDailyBriefing, type DailyBriefing } from '../../../ai/advancedAiService';
import { getExpiringContracts, getMatchesByTeam, getRecentDailyEvents, getTeamConditions } from '../../../db/queries';
import { getBoardExpectations } from '../../../engine/board/boardEngine';
import { getActiveComplaints } from '../../../engine/complaint/complaintEngine';
import { getUnreadCount } from '../../../engine/news/newsEngine';
import { NEWS_BADGES_INVALIDATED_EVENT } from '../../../engine/news/newsEvents';
import {
  getManagerIdentity,
  getManagerIdentitySummaryLine,
  MANAGER_PHILOSOPHY_LABELS,
  type ManagerIdentityProfile,
} from '../../../engine/manager/managerIdentityEngine';
import {
  getActiveConsequences,
  getBudgetPressureSnapshot,
  getMainLoopRiskItems,
  getPrepRecommendationRecords,
} from '../../../engine/manager/systemDepthEngine';
import {
  generateStaffRecommendations,
  getStaffFitSummary,
  type StaffRecommendation,
} from '../../../engine/staff/staffEngine';
import {
  getPlayerManagementInsights,
  SATISFACTION_FACTOR_LABELS,
  type PlayerManagementInsight,
} from '../../../engine/satisfaction/playerSatisfactionEngine';
import { useBgm } from '../../../hooks/useBgm';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { STAFF_ROLE_LABELS } from '../../../types/staff';
import { formatAmount } from '../../../utils/formatUtils';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MainLoopPanel } from '../components/MainLoopPanel';
import './ManagerHome.css';
import type { BudgetPressureSnapshot } from '../../../types/systemDepth';

const POSITION_LABELS: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

type TeamMatch = Awaited<ReturnType<typeof getMatchesByTeam>>[number];
type DailyEvent = Awaited<ReturnType<typeof getRecentDailyEvents>>[number];
type TeamConditionMap = Awaited<ReturnType<typeof getTeamConditions>>;
type BoardExpectation = Awaited<ReturnType<typeof getBoardExpectations>>;
type StaffFitItem = Awaited<ReturnType<typeof getStaffFitSummary>>[number];

interface DisplayRiskItem {
  title: string;
  summary: string;
}

function getUrgencyLabel(urgency: 'high' | 'medium' | 'low') {
  if (urgency === 'high') return '긴급';
  if (urgency === 'medium') return '주의';
  return '참고';
}

function getPressureTone(level?: string): 'danger' | 'accent' | 'success' {
  if (level === 'critical') return 'danger';
  if (level === 'watch') return 'accent';
  return 'success';
}

function normalizeRiskItem(item: unknown): DisplayRiskItem | null {
  if (!item || typeof item !== 'object') return null;
  const maybeTitle = 'title' in item && typeof item.title === 'string' ? item.title : null;
  const maybeSummary = 'summary' in item && typeof item.summary === 'string' ? item.summary : null;
  if (!maybeTitle && !maybeSummary) return null;
  return {
    title: maybeTitle ?? '운영 메모',
    summary: maybeSummary ?? maybeTitle ?? '세부 내용을 확인해 주세요.',
  };
}

export function ManagerHome() {
  useBgm('game');

  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const tutorialComplete = useSettingsStore((s) => s.tutorialComplete);
  const userTeam = teams.find((team) => team.id === save?.userTeamId);

  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [conditions, setConditions] = useState<TeamConditionMap>(new Map());
  const [events, setEvents] = useState<DailyEvent[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [staffRecommendations, setStaffRecommendations] = useState<StaffRecommendation[]>([]);
  const [playerInsights, setPlayerInsights] = useState<PlayerManagementInsight[]>([]);
  const [budgetPressure, setBudgetPressure] = useState<BudgetPressureSnapshot | null>(null);
  const [loopRisks, setLoopRisks] = useState<DisplayRiskItem[]>([]);
  const [managerIdentity, setManagerIdentity] = useState<ManagerIdentityProfile | null>(null);
  const [staffFitSummary, setStaffFitSummary] = useState<StaffFitItem[]>([]);

  useEffect(() => {
    if (!season || !userTeam) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [
          nextMatches,
          teamConditions,
          recentEvents,
          unreadCount,
          complaints,
          expiring,
          recommendations,
          insights,
          pressure,
          risks,
          prep,
          consequences,
          board,
          identity,
          fit,
        ] = await Promise.all([
          getMatchesByTeam(season.id, userTeam.id),
          getTeamConditions(userTeam.id, season.currentDate),
          getRecentDailyEvents(season.id, 6, 0),
          getUnreadCount(season.id).catch(() => 0),
          getActiveComplaints(userTeam.id).catch(() => []),
          getExpiringContracts(season.id).catch(() => []),
          generateStaffRecommendations(userTeam.id, season.id).catch(() => []),
          getPlayerManagementInsights(userTeam.id, season.id, 4, save?.id).catch(() => []),
          getBudgetPressureSnapshot(userTeam.id, season.id).catch(() => null),
          getMainLoopRiskItems(userTeam.id, season.id, season.currentDate, save?.id).catch(() => []),
          getPrepRecommendationRecords(userTeam.id, season.id, 3).catch(() => []),
          getActiveConsequences(userTeam.id, season.id, season.currentDate).catch(() => []),
          getBoardExpectations(userTeam.id, season.id).catch(() => null as BoardExpectation),
          save ? getManagerIdentity(save.id).catch(() => null) : Promise.resolve(null),
          getStaffFitSummary(userTeam.id, save?.id).catch(() => []),
        ]);

        if (cancelled) return;

        setMatches(nextMatches);
        setConditions(teamConditions);
        setEvents(recentEvents.filter((event) => event.eventType !== 'patch'));
        setStaffRecommendations(recommendations);
        setPlayerInsights(insights);
        setBudgetPressure(pressure);
        setLoopRisks(
          [...risks, ...prep, ...consequences]
            .map((item) => normalizeRiskItem(item))
            .filter((item): item is DisplayRiskItem => item !== null)
            .slice(0, 4),
        );
        setManagerIdentity(identity);
        setStaffFitSummary(fit);

        const nextAlerts: string[] = [];
        if (unreadCount > 0) nextAlerts.push(`읽지 않은 뉴스 ${unreadCount}건이 있습니다.`);
        if (complaints.length > 0) nextAlerts.push(`선수 불만 ${complaints.length}건이 남아 있습니다.`);
        const expiringPlayers = expiring.filter((player) => player.teamId === userTeam.id);
        if (expiringPlayers.length > 0) {
          nextAlerts.push(`${expiringPlayers[0].name} 포함 ${expiringPlayers.length}명의 계약 만료가 가까워졌습니다.`);
        }
        if (pressure?.topDrivers?.[0]) nextAlerts.push(pressure.topDrivers[0]);
        if (board?.satisfaction != null && board.satisfaction <= 30) {
          nextAlerts.push('이사회 만족도가 낮습니다. 운영 계획을 다시 점검해야 합니다.');
        }
        setAlerts(nextAlerts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [save, season, userTeam]);

  useEffect(() => {
    if (!season || !userTeam) return;
    let cancelled = false;

    const loadBriefing = async () => {
      setBriefingLoading(true);
      try {
        const nextMatch = matches.find((match) => !match.isPlayed);
        const nextOpponentId = nextMatch
          ? nextMatch.teamHomeId === userTeam.id
            ? nextMatch.teamAwayId
            : nextMatch.teamHomeId
          : undefined;
        const nextOpponentName = teams.find((team) => team.id === nextOpponentId)?.name;
        const result = await generateDailyBriefing({
          teamName: userTeam.name,
          currentDate: season.currentDate,
          nextOpponentName,
          nextMatchDate: nextMatch?.matchDate,
          teamMorale: 50,
          injuredPlayers: [],
          recentForm: matches.some((match) => match.isPlayed) ? '최근 경기 흐름 반영' : '최근 경기 데이터가 부족합니다.',
          lowSatisfactionPlayers: [],
          activeConflicts: 0,
          budgetStatus: budgetPressure?.topDrivers?.[0] ?? '재정 상태는 안정적으로 관리되고 있습니다.',
        }).catch(() => ({
          briefing: `${season.currentDate} 기준 운영 브리핑입니다.`,
          alerts: alerts.slice(0, 2),
          advice: ['다음 경기와 팀 컨디션을 먼저 확인해 주세요.'],
        }));
        if (!cancelled) setBriefing(result);
      } finally {
        if (!cancelled) setBriefingLoading(false);
      }
    };

    void loadBriefing();
    return () => {
      cancelled = true;
    };
  }, [alerts, budgetPressure?.topDrivers, matches, season, teams, userTeam]);

  useEffect(() => {
    if (!season) return;
    const handleInvalidate = async () => {
      const nextUnreadCount = await getUnreadCount(season.id).catch(() => 0);
      setAlerts((prev) => {
        const filtered = prev.filter((item) => !item.startsWith('읽지 않은 뉴스'));
        return nextUnreadCount > 0 ? [`읽지 않은 뉴스 ${nextUnreadCount}건이 있습니다.`, ...filtered] : filtered;
      });
    };
    window.addEventListener(NEWS_BADGES_INVALIDATED_EVENT, handleInvalidate);
    return () => window.removeEventListener(NEWS_BADGES_INVALIDATED_EVENT, handleInvalidate);
  }, [season]);

  const nextMatch = useMemo(() => matches.find((match) => !match.isPlayed), [matches]);
  const nextOpponentName = nextMatch
    ? teams.find((team) => team.id === (nextMatch.teamHomeId === userTeam?.id ? nextMatch.teamAwayId : nextMatch.teamHomeId))?.name
    : undefined;

  const playerRows = (userTeam?.roster ?? []).slice(0, 5).map((player) => ({
    id: player.id,
    name: player.name,
    position: POSITION_LABELS[player.position] ?? player.position,
    stamina: conditions.get(player.id)?.stamina ?? 70,
    morale: conditions.get(player.id)?.morale ?? 50,
    form: conditions.get(player.id)?.form ?? 50,
  }));

  if (!season || !save || !userTeam) {
    return <p className="fm-text-muted fm-text-md">메인 화면을 불러오는 중입니다...</p>;
  }

  const unreadNewsLabel = alerts.find((item) => item.startsWith('읽지 않은 뉴스')) ?? '읽지 않은 뉴스 없음';

  return (
    <div className="fm-animate-in">
      {!tutorialComplete ? <TutorialOverlay /> : null}

      <div className="fm-page-header">
        <h1 className="fm-page-title">팀 운영 홈</h1>
        <p className="fm-page-subtitle">다음 일정, 팀 상태, 재정과 주요 이슈를 한 번에 확인합니다.</p>
      </div>

      <MainLoopPanel
        eyebrow="매니저 루프"
        title="오늘 먼저 확인해야 할 운영 항목"
        subtitle={alerts[0] ?? '지금은 급한 경고보다 다음 일정과 팀 상태 점검이 우선입니다.'}
        insights={[
          {
            label: '다음 경기',
            value: nextOpponentName ?? '일정 없음',
            detail: nextMatch ? `${nextMatch.matchDate} / ${nextMatch.boFormat}` : '확정된 다음 일정이 없습니다.',
            tone: nextMatch ? 'accent' : 'neutral',
          },
          {
            label: '재정 상태',
            value: budgetPressure?.pressureLevel ?? '확인 중',
            detail: `Payroll ${formatAmount(budgetPressure?.totalPayroll ?? 0)} / cap ${formatAmount(budgetPressure?.salaryCap ?? 0)}`,
            tone: getPressureTone(budgetPressure?.pressureLevel),
          },
          {
            label: '팀 상태',
            value: playerRows.length > 0 ? `${Math.round(playerRows.reduce((sum, row) => sum + row.morale, 0) / playerRows.length)} 평균 사기` : '데이터 부족',
            detail: loopRisks[0]?.summary ?? '선수 상태와 리스크를 우선 확인해 주세요.',
            tone: 'accent',
          },
          {
            label: '뉴스 상태',
            value: unreadNewsLabel,
            detail: '브리핑 뉴스와 주요 기사부터 먼저 확인해 주세요.',
            tone: 'accent',
          },
        ]}
        actions={[
          { label: '시즌 진행', onClick: () => navigate('/manager/day'), variant: 'primary' },
          { label: '훈련 보기', onClick: () => navigate('/manager/training'), variant: 'info' },
          { label: '전술 보기', onClick: () => navigate('/manager/tactics'), variant: 'info' },
          { label: '뉴스 확인', onClick: () => navigate('/manager/news') },
          { label: unreadNewsLabel, onClick: () => navigate('/manager/news') },
        ]}
        note="중요 정보가 첫 화면에 먼저 보이도록 정리했고, 필요한 화면으로 바로 이동할 수 있는 구조입니다."
      />

      {loading ? <p className="fm-text-muted fm-text-md fm-mt-md">메인 화면 데이터를 정리하는 중입니다...</p> : null}

      <div className="fm-grid fm-grid--4 fm-mb-lg">
        <div className="fm-card"><div className="fm-stat"><span className="fm-stat__label">예산</span><span className="fm-stat__value fm-stat__value--accent">{formatAmount(userTeam.budget)}</span></div></div>
        <div className="fm-card"><div className="fm-stat"><span className="fm-stat__label">Payroll / Cap</span><span className="fm-stat__value">{formatAmount(budgetPressure?.totalPayroll ?? 0)} / {formatAmount(budgetPressure?.salaryCap ?? 0)}</span></div></div>
        <div className="fm-card"><div className="fm-stat"><span className="fm-stat__label">명성</span><span className="fm-stat__value">{userTeam.reputation}</span></div></div>
        <div className="fm-card"><div className="fm-stat"><span className="fm-stat__label">다음 경기</span><span className="fm-stat__value">{nextMatch ? `${nextMatch.matchDate} vs ${nextOpponentName ?? '미정'}` : '일정 없음'}</span></div></div>
      </div>

      <div className="fm-grid fm-grid--3 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">오늘의 브리핑</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {briefingLoading && !briefing ? <p className="fm-text-muted">브리핑을 정리하는 중입니다...</p> : (
              <>
                <p className="fm-text-secondary">{briefing?.briefing ?? '브리핑을 불러오지 못했습니다.'}</p>
                {(briefing?.alerts ?? []).slice(0, 2).map((item, index) => <div key={index} className="fm-alert fm-alert--warning"><span className="fm-alert__text">{item}</span></div>)}
              </>
            )}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">즉시 확인할 운영 이슈</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {(alerts.length > 0 ? alerts : ['현재는 즉시 처리할 경고보다 운영 상태 점검이 우선입니다.']).slice(0, 3).map((alert, index) => (
              <button key={index} type="button" className="fm-card fm-text-left" onClick={() => navigate(alert.includes('뉴스') ? '/manager/news' : '/manager/day')}>
                <div className="fm-text-primary fm-font-semibold fm-mb-xs">{index === 0 ? '우선 확인' : '운영 메모'}</div>
                <div className="fm-text-secondary">{alert}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">다음 이동 추천</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            <button type="button" className="fm-card fm-text-left" onClick={() => navigate('/manager/day')}>
              <div className="fm-text-primary fm-font-semibold fm-mb-xs">시즌 진행</div>
              <div className="fm-text-secondary">날짜를 넘기기 전에 다음 경기와 팀 상태를 다시 확인합니다.</div>
            </button>
            <button type="button" className="fm-card fm-text-left" onClick={() => navigate('/manager/tactics')}>
              <div className="fm-text-primary fm-font-semibold fm-mb-xs">전술 정리</div>
              <div className="fm-text-secondary">경기 준비와 코치 의견을 기준으로 전술을 다시 조정합니다.</div>
            </button>
          </div>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">코치와 선수 메모</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {staffRecommendations.slice(0, 2).map((recommendation) => (
              <button key={recommendation.title} type="button" className="fm-card fm-text-left" onClick={() => navigate(recommendation.route)}>
                <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs"><span className="fm-text-primary fm-font-semibold">{recommendation.title}</span><span className="fm-text-xs fm-text-accent">{getUrgencyLabel(recommendation.urgency)}</span></div>
                <div className="fm-text-xs fm-text-muted fm-mb-xs">{STAFF_ROLE_LABELS[recommendation.role] ?? recommendation.role}</div>
                <div className="fm-text-secondary">{recommendation.summary}</div>
              </button>
            ))}
            {playerInsights.slice(0, 2).map((insight) => (
              <button key={insight.playerId} type="button" className="fm-card fm-text-left" onClick={() => navigate('/manager/complaints')}>
                <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs"><span className="fm-text-primary fm-font-semibold">{insight.playerId}</span><span className="fm-text-xs fm-text-accent">{insight.overallSatisfaction}</span></div>
                <div className="fm-text-xs fm-text-muted fm-mb-xs">가장 약한 항목: {SATISFACTION_FACTOR_LABELS[insight.weakestFactor]} ({insight.weakestScore})</div>
                <div className="fm-text-secondary">{insight.recommendation}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">재정과 장기 리스크</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {loopRisks.slice(0, 3).map((risk, index) => <div key={index} className="fm-card"><strong className="fm-text-primary">{risk.title}</strong><p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>{risk.summary}</p></div>)}
            {staffFitSummary[0] ? <div className="fm-card"><strong className="fm-text-primary">스태프 조합 메모</strong><p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>{staffFitSummary[0].name} / {staffFitSummary[0].summary}</p></div> : null}
          </div>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">선수 컨디션</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {playerRows.length === 0 ? <p className="fm-text-muted">선수 데이터가 없습니다.</p> : playerRows.map((row) => <div key={row.id} className="fm-card"><div className="fm-text-primary fm-font-semibold">{row.name} · {row.position}</div><div className="fm-text-secondary">체력 {row.stamina} / 사기 {row.morale} / 폼 {row.form}</div></div>)}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">일정과 최근 변화</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {matches.filter((match) => !match.isPlayed).slice(0, 2).map((match) => <div key={match.id} className="fm-card"><div className="fm-text-primary fm-font-semibold">{match.matchDate}</div><div className="fm-text-secondary">{match.boFormat}</div></div>)}
            {events.slice(0, 2).map((event) => <div key={event.id} className="fm-card"><div className="fm-text-primary fm-font-semibold">{event.gameDate}</div><div className="fm-text-secondary">{event.description}</div></div>)}
          </div>
        </div>
      </div>

      {managerIdentity ? (
        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">감독 철학</span></div>
          <div className="fm-panel__body">
            <p className="fm-text-secondary fm-mb-md">{getManagerIdentitySummaryLine(managerIdentity)}</p>
            <div className="fm-grid fm-grid--4">
              {Object.entries(managerIdentity.philosophy).map(([axis, score]) => <div key={axis} className="fm-card"><div className="fm-text-xs fm-text-muted fm-mb-xs">{MANAGER_PHILOSOPHY_LABELS[axis as keyof typeof managerIdentity.philosophy]}</div><div className="fm-text-lg fm-font-semibold fm-text-primary">{score}</div></div>)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
