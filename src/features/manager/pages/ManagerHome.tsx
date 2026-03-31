import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateDailyBriefing, type DailyBriefing } from '../../../ai/advancedAiService';
import {
  getExpiringContracts,
  getMatchesByTeam,
  getRecentDailyEvents,
  getTeamConditions,
  getTeamTotalSalary,
} from '../../../db/queries';
import { getBoardExpectations } from '../../../engine/board/boardEngine';
import { getActiveComplaints } from '../../../engine/complaint/complaintEngine';
import { getInjuredPlayerIds } from '../../../engine/injury/injuryEngine';
import { getUnreadCount } from '../../../engine/news/newsEngine';
import {
  getManagerIdentity,
  getManagerIdentitySummaryLine,
  MANAGER_PHILOSOPHY_LABELS,
  type ManagerIdentityProfile,
} from '../../../engine/manager/managerIdentityEngine';
import {
  getPlayerManagementInsights,
  getSatisfactionReport,
  SATISFACTION_FACTOR_LABELS,
  type PlayerManagementInsight,
} from '../../../engine/satisfaction/playerSatisfactionEngine';
import { generateStaffRecommendations, type StaffRecommendation } from '../../../engine/staff/staffEngine';
import { useBgm } from '../../../hooks/useBgm';
import { useGameStore } from '../../../stores/gameStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { Match } from '../../../types/match';
import { STAFF_ROLE_LABELS } from '../../../types/staff';
import { formatAmount } from '../../../utils/formatUtils';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MeetingModal } from '../components/MeetingModal';
import './ManagerHome.css';

const SALARY_CAP = 400000;
const PRESS_COOLDOWN_DAYS = 7;

interface DashboardAlert {
  type: 'warning' | 'info' | 'danger';
  message: string;
  link?: string;
}

interface NewsEvent {
  id: number;
  seasonId: number;
  gameDate: string;
  eventType: string;
  targetId: string | null;
  description: string;
}

interface FocusCard {
  title: string;
  body: string;
  status: string;
  route?: string;
}

const POSITION_LABELS: Record<string, string> = {
  top: 'TOP',
  jungle: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  support: 'SUP',
};

function getDaysDiff(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgencyLabel(level: 'high' | 'medium' | 'low'): string {
  if (level === 'high') return 'Immediate';
  if (level === 'medium') return 'Watch';
  return 'Stable';
}

function getOpponentName(
  teamId: string | undefined,
  teams: Array<{ id: string; name: string }>,
): string | undefined {
  if (!teamId) return undefined;
  return teams.find((team) => team.id === teamId)?.name ?? teamId;
}

export function ManagerHome() {
  useBgm('game');

  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const tutorialComplete = useSettingsStore((s) => s.tutorialComplete);
  const navigate = useNavigate();

  const userTeam = teams.find((team) => team.id === save?.userTeamId);

  const [loading, setLoading] = useState(true);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [totalSalary, setTotalSalary] = useState(0);
  const [conditions, setConditions] = useState<Map<string, { stamina: number; morale: number; form: number }>>(new Map());
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [modalMode, setModalMode] = useState<'meeting' | 'press' | null>(null);
  const [playerMeetingDates, setPlayerMeetingDates] = useState<Record<string, string>>({});
  const [lastPressDate, setLastPressDate] = useState<string | null>(null);
  const [playerInsights, setPlayerInsights] = useState<PlayerManagementInsight[]>([]);
  const [staffRecommendations, setStaffRecommendations] = useState<StaffRecommendation[]>([]);
  const [managerIdentity, setManagerIdentity] = useState<ManagerIdentityProfile | null>(null);
  const briefingRequestRef = useRef<string | null>(null);

  const pressCooldown = season && lastPressDate
    ? Math.max(0, PRESS_COOLDOWN_DAYS - getDaysDiff(lastPressDate, season.currentDate))
    : 0;

  const buildFallbackBriefing = useCallback((context: {
    teamName: string;
    currentDate: string;
    nextOpponentName?: string;
    nextMatchDate?: string;
    teamMorale: number;
    injuredPlayers: string[];
    recentForm: string;
    lowSatisfactionPlayers: string[];
    activeConflicts: number;
    budgetStatus: string;
  }): DailyBriefing => {
    const alertsText: string[] = [];
    const advice: string[] = [];

    if (context.injuredPlayers.length > 0) {
      alertsText.push(`부상 관리가 필요한 선수: ${context.injuredPlayers.join(', ')}`);
    }
    if (context.lowSatisfactionPlayers.length > 0) {
      alertsText.push(`만족도가 낮은 선수: ${context.lowSatisfactionPlayers.slice(0, 2).join(', ')}`);
    }
    if (context.activeConflicts > 0) {
      alertsText.push(`즉시 확인할 선수 이슈 ${context.activeConflicts}건이 남아 있습니다.`);
    }

    advice.push(
      context.teamMorale < 55
        ? '지금은 훈련 강도보다 회복, 면담, 분위기 수습을 우선하는 편이 안전합니다.'
        : '팀 분위기는 버틸 만합니다. 다음 경기 준비와 전술 정리에 집중해도 됩니다.',
    );

    if (context.nextOpponentName) {
      advice.push(`${context.nextOpponentName}전을 앞두고 너무 많은 날짜를 넘기기보다 준비 상태를 먼저 점검하세요.`);
    }

    return {
      briefing: `${context.currentDate} 기준 ${context.teamName} 일일 브리핑입니다. 최근 흐름은 ${context.recentForm}이며, 현재 팀 사기는 ${context.teamMorale}입니다. 오늘은 단순히 날짜를 넘기기보다 다음 경기와 선수단 분위기에 어떤 변수와 기회가 남아 있는지 함께 점검할 필요가 있습니다.`,
      alerts: alertsText,
      advice,
    };
  }, []);

  useEffect(() => {
    if (!season || !userTeam) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [matches, salary, teamConditions, events, insights, recommendations, identity] = await Promise.all([
          getMatchesByTeam(season.id, userTeam.id),
          getTeamTotalSalary(userTeam.id),
          getTeamConditions(userTeam.id, season.currentDate),
          getRecentDailyEvents(season.id, 6, 0),
          getPlayerManagementInsights(userTeam.id, season.id, 4).catch(() => []),
          generateStaffRecommendations(userTeam.id, season.id).catch(() => []),
          save ? getManagerIdentity(save.id).catch(() => null) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setUpcomingMatches(matches.filter((match) => !match.isPlayed).slice(0, 3));
        setRecentMatches(matches.filter((match) => match.isPlayed).slice(-3).reverse());
        setTotalSalary(salary);
        setConditions(teamConditions);
        setNewsEvents(events.filter((event) => event.eventType !== 'patch'));
        setPlayerInsights(insights);
        setStaffRecommendations(recommendations);
        setManagerIdentity(identity);

        const nextAlerts: DashboardAlert[] = [];
        const [expiring, complaints, unreadCount, board] = await Promise.all([
          getExpiringContracts(season.id),
          getActiveComplaints(userTeam.id),
          getUnreadCount(season.id),
          getBoardExpectations(userTeam.id, season.id),
        ]);

        const expiringPlayers = expiring.filter((player) => player.teamId === userTeam.id);
        if (expiringPlayers.length > 0) {
          nextAlerts.push({
            type: 'warning',
            message: `${expiringPlayers[0].name} 포함 ${expiringPlayers.length}명의 계약 만료가 가까워졌습니다.`,
            link: '/manager/roster',
          });
        }

        if (complaints.length > 0) {
          nextAlerts.push({
            type: 'danger',
            message: `선수 불만 ${complaints.length}건이 열려 있습니다.`,
            link: '/manager/complaints',
          });
        }

        if (salary / SALARY_CAP >= 0.9) {
          nextAlerts.push({
            type: 'warning',
            message: `총 연봉이 샐러리캡의 ${((salary / SALARY_CAP) * 100).toFixed(1)}%입니다.`,
            link: '/manager/finance',
          });
        }

        if (unreadCount > 0) {
          nextAlerts.push({
            type: 'info',
            message: `읽지 않은 뉴스 ${unreadCount}건이 있습니다.`,
            link: '/manager/news',
          });
        }

        if (board && board.satisfaction <= 30) {
          nextAlerts.push({
            type: 'danger',
            message: '이사회 만족도가 낮습니다. 단기 성과 회복이 필요합니다.',
            link: '/manager/board',
          });
        }

        if (!cancelled) {
          setAlerts(nextAlerts);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [save, season, userTeam]);

  useEffect(() => {
    if (!season || !userTeam) return;

    const requestKey = `${userTeam.id}:${season.currentDate}`;
    if (briefingRequestRef.current === requestKey) return;
    briefingRequestRef.current = requestKey;

    let cancelled = false;

    const loadBriefing = async () => {
      setBriefingLoading(true);

      try {
        const injuredIds = await getInjuredPlayerIds(userTeam.id);
        const injuredPlayers = userTeam.roster.filter((player) => injuredIds.has(player.id)).map((player) => player.name);
        const lowSatisfactionEntries = await getSatisfactionReport(userTeam.id).catch(() => []);
        const lowSatisfactionPlayers = lowSatisfactionEntries
          .filter((entry) => entry.overallSatisfaction < 40)
          .map((entry) => userTeam.roster.find((player) => player.id === entry.playerId)?.name ?? entry.playerId);
        const complaints = await getActiveComplaints(userTeam.id).catch(() => []);
        const nextMatch = upcomingMatches[0];
        const nextOpponentId = nextMatch
          ? (nextMatch.teamHomeId === userTeam.id ? nextMatch.teamAwayId : nextMatch.teamHomeId)
          : undefined;
        const avgMorale = userTeam.roster.length > 0
          ? Math.round(userTeam.roster.reduce((sum, player) => sum + (conditions.get(player.id)?.morale ?? 50), 0) / userTeam.roster.length)
          : 50;
        const recentForm = recentMatches.length > 0 ? `최근 ${recentMatches.length}경기 소화` : '최근 경기 데이터가 충분하지 않습니다';
        const budgetStatus = userTeam.budget >= 0
          ? '재정은 당장 안정적이지만 장기 계약과 주급 관리까지 함께 볼 필요가 있습니다.'
          : '재정 압박이 감지됩니다. 스폰서와 지출 관리 우선순위를 다시 잡아야 합니다.';

        const context = {
          teamName: userTeam.name,
          currentDate: season.currentDate,
          nextOpponentName: getOpponentName(nextOpponentId, teams),
          nextMatchDate: nextMatch?.matchDate,
          teamMorale: avgMorale,
          injuredPlayers,
          recentForm,
          lowSatisfactionPlayers,
          activeConflicts: complaints.length,
          budgetStatus,
        };

        const briefingPromise = generateDailyBriefing(context);
        const timeoutPromise = new Promise<DailyBriefing>((resolve) => {
          window.setTimeout(() => resolve(buildFallbackBriefing(context)), 3500);
        });

        const nextBriefing = await Promise.race([briefingPromise, timeoutPromise]);
        if (!cancelled) {
          setBriefing(nextBriefing);
        }
      } catch (error) {
        console.warn('[ManagerHome] briefing fallback:', error);
        if (!cancelled) {
          setBriefing(
            buildFallbackBriefing({
              teamName: userTeam.name,
              currentDate: season.currentDate,
              teamMorale: 50,
              injuredPlayers: [],
              recentForm: '최근 경기 데이터가 충분하지 않습니다',
              lowSatisfactionPlayers: [],
              activeConflicts: 0,
              budgetStatus: userTeam.budget >= 0
                ? '재정은 안정적이지만 장기 플랜 점검은 필요합니다.'
                : '재정이 흔들리고 있어 지출 통제가 필요합니다.',
            }),
          );
        }
      } finally {
        if (!cancelled) {
          setBriefingLoading(false);
        }
      }
    };

    void loadBriefing();

    return () => {
      cancelled = true;
    };
  }, [briefingRequestRef, buildFallbackBriefing, conditions, recentMatches, season, teams, upcomingMatches, userTeam]);

  if (!season || !save || !userTeam) {
    return <p className="fm-text-muted fm-text-md">Loading dashboard...</p>;
  }

  const focusCards: FocusCard[] = [
    {
      title: 'Training',
      body: 'Weekly schedule now auto-applies during season progression. Adjust focus and intensity before advancing.',
      status: 'Auto-applied',
      route: '/manager/training',
    },
    {
      title: 'Player management',
      body: alerts.some((alert) => alert.type === 'danger')
        ? 'Open complaints or morale issues need attention before they snowball into form loss.'
        : 'No major player fire is active right now, but monitor morale and trust before the next match.',
      status: alerts.some((alert) => alert.type === 'danger') ? 'Needs action' : 'Stable',
      route: '/manager/complaints',
    },
    {
      title: 'Match prep',
      body: upcomingMatches[0]
        ? 'Review the next opponent, draft direction, and tactical priorities before matchday arrives.'
        : 'No urgent official match is queued, so you can invest in growth and recovery.',
      status: upcomingMatches[0] ? `Next match ${upcomingMatches[0].matchDate}` : 'No urgent match',
      route: '/manager/tactics',
    },
  ];

  const urgentIssue = alerts[0]
    ? {
        title: alerts[0].type === 'danger' ? '오늘 가장 시급한 이슈' : '오늘 우선 점검할 항목',
        body: alerts[0].message,
        route: alerts[0].link,
      }
    : upcomingMatches[0]
      ? {
          title: '다음 경기 준비',
          body: `${upcomingMatches[0].matchDate} 일정이 가까워지고 있습니다. 날짜를 넘기기 전에 훈련 방향, 전술, 선수 컨디션을 먼저 잠가두는 편이 안전합니다.`,
          route: '/manager/pre-match',
        }
      : {
          title: '안정 구간',
          body: '즉시 폭발할 위기는 없습니다. 지금은 다음 주 흐름을 설계하기 좋은 정비 구간입니다.',
          route: '/manager/day',
        };

  const briefingOpportunities = [
    upcomingMatches[0]
      ? `${upcomingMatches[0].matchDate} 공식전 전까지 준비를 더 날카롭게 다듬을 시간이 남아 있습니다.`
      : '당장 급한 공식전 압박이 없어 성장과 회복에 집중할 수 있는 구간입니다.',
    staffRecommendations[0] ? `${staffRecommendations[0].title}: ${staffRecommendations[0].summary}` : null,
    managerIdentity ? getManagerIdentitySummaryLine(managerIdentity) : null,
  ].filter(Boolean) as string[];

  const briefingActions = [
    ...(briefing?.advice ?? []),
    ...focusCards.map((card) => card.body),
  ].slice(0, 3);

  return (
    <div className="fm-animate-in">
      {!tutorialComplete && <TutorialOverlay />}

      <div className="fm-page-header">
        <h1 className="fm-page-title">Manager Dashboard</h1>
      </div>

      {loading && (
        <div className="fm-alert fm-alert--info fm-mb-md">
          <span className="fm-alert__text">Refreshing the latest team state.</span>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="fm-flex-col fm-gap-sm fm-mb-lg">
          {alerts.map((alert, index) => (
            <button
              key={`${alert.message}-${index}`}
              className={`fm-alert ${
                alert.type === 'danger' ? 'fm-alert--danger' : alert.type === 'warning' ? 'fm-alert--warning' : 'fm-alert--info'
              }`}
              onClick={() => alert.link && navigate(alert.link)}
              type="button"
            >
              <span className="fm-alert__text">{alert.message}</span>
            </button>
          ))}
        </div>
      )}

      <div className="fm-grid fm-grid--4 fm-mb-lg">
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Budget</span>
            <span className="fm-stat__value fm-stat__value--accent">{formatAmount(userTeam.budget)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Total salary</span>
            <span className="fm-stat__value">{formatAmount(totalSalary)}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Reputation</span>
            <span className="fm-stat__value">{userTeam.reputation}</span>
          </div>
        </div>
        <div className="fm-card">
          <div className="fm-stat">
            <span className="fm-stat__label">Next match</span>
            <span className="fm-stat__value">{upcomingMatches[0]?.matchDate ?? 'None'}</span>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-lg">
        <div className="fm-panel__header">
          <span className="fm-panel__title">오늘 가장 시급한 이슈</span>
        </div>
        <div className="fm-panel__body">
          <button
            type="button"
            className="fm-card fm-text-left"
            style={{ width: '100%' }}
            onClick={() => urgentIssue.route && navigate(urgentIssue.route)}
          >
            <div className="fm-text-primary fm-font-semibold fm-mb-xs">{urgentIssue.title}</div>
            <div className="fm-text-secondary">{urgentIssue.body}</div>
          </button>
        </div>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">일간 브리핑</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {briefingLoading && !briefing ? (
              <p className="fm-text-muted">브리핑을 정리하는 중입니다...</p>
            ) : (
              <>
                <p className="fm-text-secondary">{briefing?.briefing ?? '브리핑을 불러오지 못했습니다.'}</p>
                <div className="fm-card">
                  <div className="fm-text-xs fm-text-muted fm-mb-xs">위험</div>
                  <div className="fm-flex-col fm-gap-xs">
                    {(briefing?.alerts ?? []).length > 0 ? (
                      (briefing?.alerts ?? []).map((item, index) => (
                        <div key={`briefing-alert-${index}`} className="fm-alert fm-alert--warning">
                          <span className="fm-alert__text">{item}</span>
                        </div>
                      ))
                    ) : (
                      <span className="fm-text-secondary">당장 폭발하는 리스크는 없습니다.</span>
                    )}
                  </div>
                </div>
                <div className="fm-card">
                  <div className="fm-text-xs fm-text-muted fm-mb-xs">기회</div>
                  <div className="fm-flex-col fm-gap-xs">
                    {briefingOpportunities.slice(0, 3).map((item, index) => (
                      <span key={`briefing-opportunity-${index}`} className="fm-text-secondary">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="fm-card">
                  <div className="fm-text-xs fm-text-muted fm-mb-xs">추천 행동</div>
                  <div className="fm-flex-col fm-gap-xs">
                    {briefingActions.map((item, index) => (
                      <span key={`briefing-action-${index}`} className="fm-text-secondary">{item}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">핵심 결정 축</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {focusCards.map((card) => (
              <button
                key={card.title}
                type="button"
                className="fm-card fm-text-left"
                onClick={() => card.route && navigate(card.route)}
              >
                <div className="fm-text-primary fm-font-semibold fm-mb-xs">{card.title}</div>
                <div className="fm-text-xs fm-text-accent fm-mb-xs">{card.status}</div>
                <div className="fm-text-secondary">{card.body}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {managerIdentity && (
        <div className="fm-panel fm-mb-lg">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Manager philosophy</span>
          </div>
          <div className="fm-panel__body">
            <div className="fm-flex fm-justify-between fm-items-center fm-mb-sm">
              <span className="fm-text-secondary">Current team read</span>
              <span className="fm-text-xs fm-text-accent">
                {managerIdentity.dominantTraits.length > 0 ? managerIdentity.dominantTraits.join(' / ') : 'Balanced'}
              </span>
            </div>
            <p className="fm-text-secondary fm-mb-md">{getManagerIdentitySummaryLine(managerIdentity)}</p>
            <div className="fm-grid fm-grid--4">
              {Object.entries(managerIdentity.philosophy).map(([axis, score]) => (
                <div key={axis} className="fm-card">
                  <div className="fm-text-xs fm-text-muted fm-mb-xs">
                    {MANAGER_PHILOSOPHY_LABELS[axis as keyof typeof managerIdentity.philosophy]}
                  </div>
                  <div className="fm-text-lg fm-font-semibold fm-text-primary">{score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Staff recommendations</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {staffRecommendations.length === 0 ? (
              <p className="fm-text-muted">No staff recommendation is active right now.</p>
            ) : (
              staffRecommendations.map((recommendation) => (
                <button
                  key={`${recommendation.role}-${recommendation.title}`}
                  type="button"
                  className="fm-card fm-text-left"
                  onClick={() => navigate(recommendation.route)}
                >
                  <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                    <span className="fm-text-primary fm-font-semibold">{recommendation.title}</span>
                    <span className="fm-text-xs fm-text-accent">{getUrgencyLabel(recommendation.urgency)}</span>
                  </div>
                  <div className="fm-text-xs fm-text-muted fm-mb-xs">
                    {STAFF_ROLE_LABELS[recommendation.role] ?? recommendation.role}
                  </div>
                  <div className="fm-text-secondary">{recommendation.summary}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Player management points</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {playerInsights.length === 0 ? (
              <p className="fm-text-muted">No high-risk player issue is currently detected.</p>
            ) : (
              playerInsights.map((insight) => {
                const playerName = userTeam.roster.find((player) => player.id === insight.playerId)?.name ?? insight.playerId;
                return (
                  <button
                    key={insight.playerId}
                    type="button"
                    className="fm-card fm-text-left"
                    onClick={() => navigate('/manager/complaints')}
                  >
                    <div className="fm-flex fm-justify-between fm-items-center fm-mb-xs">
                      <span className="fm-text-primary fm-font-semibold">{playerName}</span>
                      <span className="fm-text-xs fm-text-accent">{insight.overallSatisfaction}</span>
                    </div>
                    <div className="fm-text-xs fm-text-muted fm-mb-xs">
                      Weakest factor: {SATISFACTION_FACTOR_LABELS[insight.weakestFactor]} ({insight.weakestScore})
                    </div>
                    <div className="fm-text-secondary">{insight.recommendation}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="fm-flex fm-gap-sm fm-mb-lg">
        <button className="fm-btn fm-btn--primary" onClick={() => setModalMode('meeting')}>
          Player meeting
        </button>
        <button
          className="fm-btn fm-btn--info"
          onClick={() => pressCooldown === 0 && setModalMode('press')}
          disabled={pressCooldown > 0}
        >
          Press conference {pressCooldown > 0 ? `(${pressCooldown}d)` : ''}
        </button>
        <button className="fm-btn" onClick={() => navigate('/manager/day')}>
          Advance season
        </button>
      </div>

      <div className="fm-grid fm-grid--2 fm-mb-lg">
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Player condition</span>
          </div>
          <div className="fm-panel__body--flush">
            <div className="fm-table-wrap">
              <table className="fm-table fm-table--striped">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Pos</th>
                    <th>Stamina</th>
                    <th>Morale</th>
                    <th>Form</th>
                  </tr>
                </thead>
                <tbody>
                  {userTeam.roster.map((player) => {
                    const condition = conditions.get(player.id);
                    return (
                      <tr key={player.id}>
                        <td className="fm-cell--name">{player.name}</td>
                        <td>{POSITION_LABELS[player.position] ?? player.position}</td>
                        <td>{condition?.stamina ?? 70}</td>
                        <td>{condition?.morale ?? 50}</td>
                        <td>{condition?.form ?? 50}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Schedule and recent news</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {upcomingMatches.map((match) => (
              <div key={match.id} className="fm-card">
                <div className="fm-text-primary fm-font-semibold">{match.matchDate ?? '-'}</div>
                <div className="fm-text-secondary">{match.teamHomeId} vs {match.teamAwayId}</div>
              </div>
            ))}

            {newsEvents.map((event) => (
              <div key={event.id} className="fm-card">
                <div className="fm-text-primary fm-font-semibold">{event.gameDate}</div>
                <div className="fm-text-secondary">{event.description}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {recentMatches.length > 0 && (
        <div className="fm-panel">
          <div className="fm-panel__header">
            <span className="fm-panel__title">Recent matches</span>
          </div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {recentMatches.map((match) => (
              <div key={match.id} className="fm-card">
                <div className="fm-text-primary fm-font-semibold">{match.matchDate ?? '-'}</div>
                <div className="fm-text-secondary">{match.teamHomeId} vs {match.teamAwayId}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalMode && (
        <MeetingModal
          mode={modalMode}
          teamName={userTeam.name}
          teamId={userTeam.id}
          saveId={save?.id}
          players={userTeam.roster}
          currentDate={season.currentDate}
          recentResults={recentMatches.map((match) => `${match.teamHomeId} vs ${match.teamAwayId}`).join(', ')}
          cooldownDays={modalMode === 'press' ? pressCooldown : undefined}
          playerMeetingDates={playerMeetingDates}
          onMeetingComplete={(playerId) => {
            setPlayerMeetingDates((prev) => ({ ...prev, [playerId]: season.currentDate }));
          }}
          onClose={(didComplete) => {
            if (modalMode === 'press' && didComplete) {
              setLastPressDate(season.currentDate);
            }
            if (didComplete && save) {
              void getManagerIdentity(save.id)
                .then((identity) => {
                  setManagerIdentity(identity);
                })
                .catch(() => undefined);
            }
            setModalMode(null);
          }}
        />
      )}
    </div>
  );
}
