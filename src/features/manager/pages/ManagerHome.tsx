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
import { getCurrentOffseasonState, OFFSEASON_PHASE_LABELS, type OffseasonState } from '../../../engine/season/offseasonEngine';
import { useBgm } from '../../../hooks/useBgm';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { STAFF_ROLE_LABELS } from '../../../types/staff';
import type { BudgetPressureSnapshot } from '../../../types/systemDepth';
import { formatAmount } from '../../../utils/formatUtils';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MainLoopPanel } from '../components/MainLoopPanel';
import './ManagerHome.css';

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SPT',
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
    summary: maybeSummary ?? maybeTitle ?? '상세 내용을 확인해 주세요.',
  };
}

export function ManagerHome() {
  useBgm('game');

  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const dayType = useGameStore((s) => s.dayType);
  const tutorialComplete = useSettingsStore((s) => s.tutorialComplete);
  const userTeam = teams.find((team) => team.id === save?.userTeamId);

  const [loading, setLoading] = useState(true);
  const [offseasonState, setOffseasonState] = useState<OffseasonState | null>(null);
  const [matches, setMatches] = useState<TeamMatch[]>([]);
  const [conditions, setConditions] = useState<TeamConditionMap>(new Map());
  const [events, setEvents] = useState<DailyEvent[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [staffRecommendations, setStaffRecommendations] = useState<StaffRecommendation[]>([]);
  const [playerInsights, setPlayerInsights] = useState<PlayerManagementInsight[]>([]);
  const [boardExpectation, setBoardExpectation] = useState<BoardExpectation>(null);
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
          offseason,
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
          save ? getCurrentOffseasonState(save.id).catch(() => null) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setMatches(nextMatches);
        setConditions(teamConditions);
        setEvents(recentEvents.filter((event) => event.eventType !== 'patch'));
        setStaffRecommendations(recommendations);
        setPlayerInsights(insights);
        setBoardExpectation(board);
        setBudgetPressure(pressure);
        setOffseasonState(offseason);
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
          nextAlerts.push('보드 만족도가 매우 낮습니다. 시즌 계획과 지출 구조를 다시 점검해야 합니다.');
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
          recentForm: matches.some((match) => match.isPlayed) ? '최근 경기 흐름이 반영됩니다.' : '최근 경기 데이터가 아직 부족합니다.',
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

  const playedMatches = matches.filter((m) => m.isPlayed);
  const wins = playedMatches.filter((m) => {
    if (m.teamHomeId === userTeam?.id) return m.scoreHome > m.scoreAway;
    return m.scoreAway > m.scoreHome;
  }).length;
  const losses = playedMatches.length - wins;
  const recentFive = playedMatches.slice(-5).map((m) => {
    const isWin = m.teamHomeId === userTeam?.id ? m.scoreHome > m.scoreAway : m.scoreAway > m.scoreHome;
    return isWin ? 'W' : 'L';
  });

  const avgCondition = playerRows.length > 0
    ? Math.round(playerRows.reduce((sum, r) => sum + r.stamina + r.morale, 0) / (playerRows.length * 2))
    : null;

  function getBarColor(value: number): string {
    if (value >= 70) return 'green';
    if (value >= 40) return 'yellow';
    return 'red';
  }

  const dynamicCta: Array<{ label: string; route: string; variant?: 'primary' | 'info' }> = dayType === 'match_day'
    ? [
        { label: '경기 준비 확인', route: '/manager/pre-match', variant: 'primary' },
        { label: '전술 확인', route: '/manager/tactics', variant: 'info' },
        { label: '드래프트 보기', route: '/manager/draft', variant: 'info' },
      ]
    : dayType === 'rest'
    ? [
        { label: '선수 상태 확인', route: '/manager/roster', variant: 'primary' },
        { label: '이적 시장 확인', route: '/manager/transfer', variant: 'info' },
        { label: '뉴스 확인', route: '/manager/news' },
      ]
    : [
        { label: '시즌 진행', route: '/manager/day', variant: 'primary' },
        { label: '훈련 보기', route: '/manager/training', variant: 'info' },
        { label: '전술 보기', route: '/manager/tactics', variant: 'info' },
      ];

  if (!season || !save || !userTeam) {
    return <p className="fm-text-muted fm-text-md">메인 화면을 불러오는 중입니다...</p>;
  }

  const unreadNewsLabel = alerts.find((item) => item.startsWith('읽지 않은 뉴스')) ?? '읽지 않은 뉴스 없음';
  const coreNotes = (alerts.length > 0 ? alerts : ['지금은 긴급 경고보다 다음 경기와 팀 상태를 먼저 확인할 타이밍입니다.']).slice(0, 3);

  return (
    <div className="fm-animate-in">
      {!tutorialComplete ? <TutorialOverlay /> : null}

      <div className="fm-page-header">
        <h1 className="fm-page-title">팀 운영 허브</h1>
        <p className="fm-page-subtitle">오늘 처리할 운영 판단과 다음 이동만 한눈에 보이도록 정리했습니다.</p>
      </div>

      <MainLoopPanel
        eyebrow="매니저 루프"
        title="오늘 확인해야 할 일과 다음 경기 준비 흐름"
        subtitle={alerts[0] ?? '급한 경고가 없으면 다음 경기와 팀 컨디션을 먼저 확인하면 됩니다.'}
        insights={[
          {
            label: '다음 경기',
            value: nextOpponentName ?? '일정 없음',
            detail: nextMatch ? `${nextMatch.matchDate} / ${nextMatch.boFormat}` : '확정된 다음 일정이 아직 없습니다.',
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
            detail: '누적된 소식은 뉴스에서 보고, 여기서는 오늘의 결정만 빠르게 정리합니다.',
            tone: 'accent',
          },
        ]}
        actions={[
          { label: '시즌 진행', onClick: () => navigate('/manager/day'), variant: 'primary' },
          { label: '훈련 보기', onClick: () => navigate('/manager/training'), variant: 'info' },
          { label: '전술 보기', onClick: () => navigate('/manager/tactics'), variant: 'info' },
          { label: unreadNewsLabel, onClick: () => navigate('/manager/news') },
        ]}
      />

      {loading ? <p className="fm-text-muted fm-text-md fm-mt-md">메인 화면 데이터를 정리하는 중입니다...</p> : null}

      {offseasonState && (
        <div className="fm-alert fm-alert--info fm-mb-lg" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="fm-alert__text">
            오프시즌 진행 중: <strong>{OFFSEASON_PHASE_LABELS[offseasonState.phase]}</strong> ({offseasonState.daysRemaining}일 남음)
          </span>
        </div>
      )}

      <div className="fm-grid fm-grid--4 fm-mb-lg">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">시즌 전적</span>
            <span className="fm-stat__value fm-stat__value--accent">{playedMatches.length > 0 ? `${wins}승 ${losses}패` : '경기 없음'}</span>
          </div>
          {recentFive.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {recentFive.map((result, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: result === 'W' ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)',
                    color: '#fff',
                  }}
                >
                  {result}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">이사회 만족도</span>
            <span className="fm-stat__value">{boardExpectation?.satisfaction != null ? `${boardExpectation.satisfaction}/100` : '-'}</span>
          </div>
          {boardExpectation?.satisfaction != null && (
            <div className="fm-bar fm-mt-xs">
              <div className={`fm-bar__fill fm-bar__fill--${getBarColor(boardExpectation.satisfaction)}`} style={{ width: `${boardExpectation.satisfaction}%` }} />
            </div>
          )}
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">팀 평균 컨디션</span>
            <span className="fm-stat__value">{avgCondition != null ? `${avgCondition}/100` : '-'}</span>
          </div>
          {avgCondition != null && (
            <div className="fm-bar fm-mt-xs">
              <div className={`fm-bar__fill fm-bar__fill--${getBarColor(avgCondition)}`} style={{ width: `${avgCondition}%` }} />
            </div>
          )}
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">다음 경기</span>
            <span className="fm-stat__value">{nextMatch ? `vs ${nextOpponentName ?? '미정'}` : '일정 없음'}</span>
          </div>
          {nextMatch && <div className="fm-text-xs fm-text-muted fm-mt-xs">{nextMatch.matchDate} / {nextMatch.boFormat}</div>}
        </div>
      </div>

      <div className="fm-grid fm-grid--3 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">오늘 브리핑</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {briefingLoading && !briefing ? <p className="fm-text-muted">브리핑을 정리하는 중입니다...</p> : (
              <>
                <p className="fm-text-secondary">{briefing?.briefing ?? '브리핑을 불러오지 못했습니다.'}</p>
                {(briefing?.alerts ?? []).slice(0, 2).map((item, index) => (
                  <div key={index} className="fm-alert fm-alert--warning">
                    <span className="fm-alert__text">{item}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">지금 바로 볼 것</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {coreNotes.map((alert, index) => (
              <button key={index} type="button" className="fm-card fm-text-left" onClick={() => navigate(alert.includes('뉴스') ? '/manager/news' : '/manager/day')}>
                <div className="fm-text-primary fm-font-semibold fm-mb-xs">{index === 0 ? '우선 확인' : '운영 메모'}</div>
                <div className="fm-text-secondary">{alert}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">지금 할 수 있는 액션</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {dynamicCta.map((cta) => (
              <button key={cta.route} type="button" className="fm-card fm-text-left" onClick={() => navigate(cta.route)}>
                <div className={`fm-text-primary fm-font-semibold fm-mb-xs${cta.variant === 'primary' ? ' fm-text-accent' : ''}`}>{cta.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <details className="fm-disclosure fm-mb-lg">
        <summary>상세 운영 메모 보기</summary>
        <div className="fm-disclosure__body">
          <div className="fm-grid fm-grid--2 fm-mb-lg">
            <div className="fm-panel">
              <div className="fm-panel__header"><span className="fm-panel__title">코치와 선수 메모</span></div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                {staffRecommendations.slice(0, 2).map((recommendation) => (
                  <button key={recommendation.title} type="button" className="fm-card fm-text-left" onClick={() => navigate(recommendation.route)}>
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                      <span className="fm-text-primary fm-font-semibold">{recommendation.title}</span>
                      <span className="fm-text-xs fm-text-accent">{getUrgencyLabel(recommendation.urgency)}</span>
                    </div>
                    <div className="fm-text-xs fm-text-muted fm-mb-xs">{STAFF_ROLE_LABELS[recommendation.role] ?? recommendation.role}</div>
                    <div className="fm-text-secondary">{recommendation.summary}</div>
                  </button>
                ))}
                {playerInsights.slice(0, 2).map((insight) => (
                  <button key={insight.playerId} type="button" className="fm-card fm-text-left" onClick={() => navigate('/manager/complaints')}>
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                      <span className="fm-text-primary fm-font-semibold">{userTeam.roster.find((p) => p.id === insight.playerId)?.name ?? '선수 정보 없음'}</span>
                      <span className="fm-text-xs fm-text-accent">만족도 {insight.overallSatisfaction}</span>
                    </div>
                    <div className="fm-text-xs fm-text-muted fm-mb-xs">가장 약한 항목: {SATISFACTION_FACTOR_LABELS[insight.weakestFactor]} ({insight.weakestScore})</div>
                    <div className="fm-text-secondary">{insight.recommendation}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="fm-panel">
              <div className="fm-panel__header"><span className="fm-panel__title">재정과 장기 리스크</span></div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                {loopRisks.slice(0, 3).map((risk, index) => (
                  <div key={index} className="fm-card">
                    <strong className="fm-text-primary">{risk.title}</strong>
                    <p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>{risk.summary}</p>
                  </div>
                ))}
                {staffFitSummary[0] ? (
                  <div className="fm-card">
                    <strong className="fm-text-primary">스태프 조합 메모</strong>
                    <p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>{staffFitSummary[0].name} / {staffFitSummary[0].summary}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="fm-grid fm-grid--2 fm-mb-lg">
            <div className="fm-panel">
              <div className="fm-panel__header"><span className="fm-panel__title">선수 컨디션</span></div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                {playerRows.length === 0 ? <p className="fm-text-muted">선수 데이터가 없습니다.</p> : playerRows.map((row) => (
                  <div key={row.id} className="fm-card">
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                      <span className="fm-text-primary fm-font-semibold">{row.name}</span>
                      <span className="fm-text-xs fm-text-muted">{row.position}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      {[{ label: '체력', value: row.stamina }, { label: '사기', value: row.morale }, { label: '폼', value: row.form }].map(({ label, value }) => (
                        <div key={label}>
                          <div className="fm-text-xs fm-text-muted" style={{ marginBottom: 2 }}>{label} {value}</div>
                          <div className="fm-bar">
                            <div className={`fm-bar__fill fm-bar__fill--${getBarColor(value)}`} style={{ width: `${value}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="fm-panel">
              <div className="fm-panel__header"><span className="fm-panel__title">일정과 최근 변화</span></div>
              <div className="fm-panel__body fm-flex-col fm-gap-sm">
                {matches.filter((match) => !match.isPlayed).slice(0, 2).map((match) => (
                  <div key={match.id} className="fm-card">
                    <div className="fm-text-primary fm-font-semibold">{match.matchDate}</div>
                    <div className="fm-text-secondary">{match.boFormat}</div>
                  </div>
                ))}
                {events.slice(0, 2).map((event) => (
                  <div key={event.id} className="fm-card">
                    <div className="fm-text-primary fm-font-semibold">{event.gameDate}</div>
                    <div className="fm-text-secondary">{event.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {managerIdentity ? (
            <div className="fm-panel">
              <div className="fm-panel__header"><span className="fm-panel__title">감독 철학</span></div>
              <div className="fm-panel__body">
                <p className="fm-text-secondary fm-mb-md">{getManagerIdentitySummaryLine(managerIdentity)}</p>
                <div className="fm-grid fm-grid--4">
                  {Object.entries(managerIdentity.philosophy).map(([axis, score]) => (
                    <div key={axis} className="fm-card">
                      <div className="fm-text-xs fm-text-muted fm-mb-xs">{MANAGER_PHILOSOPHY_LABELS[axis as keyof typeof managerIdentity.philosophy]}</div>
                      <div className="fm-text-lg fm-font-semibold fm-text-primary">{score}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
