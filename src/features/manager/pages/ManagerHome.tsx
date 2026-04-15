import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateDailyBriefing, type DailyBriefing } from '../../../ai/advancedAiService';
import { getExpiringContracts, getMatchesByTeam, getRecentDailyEvents, getTeamConditions } from '../../../db/queries';
import { getBoardExpectations } from '../../../engine/board/boardEngine';
import { getActiveComplaints } from '../../../engine/complaint/complaintEngine';
import { getInboxMessages } from '../../../engine/inbox/inboxEngine';
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
import { useMatchStore } from '../../../stores/matchStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { STAFF_ROLE_LABELS } from '../../../types/staff';
import type { BudgetPressureSnapshot } from '../../../types/systemDepth';
import { formatAmount } from '../../../utils/formatUtils';
import { TutorialOverlay } from '../../tutorial/TutorialOverlay';
import { MainLoopPanel } from '../components/MainLoopPanel';
import { getLoopRiskRoute } from '../utils/loopRiskRouting';
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
  route: string;
}

interface FeaturedInboxFollowUp {
  title: string;
  summary: string;
  actionRoute: string | null;
}

interface HomeLoopAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'info';
  detail?: string;
}

interface SpotlightChoice {
  title: string;
  summary: string;
  route: string;
  cta: string;
}

interface RetentionStoryChoice {
  title: string;
  summary: string;
  route: string;
  cta: string;
}

const MATCH_FOLLOW_UP_LABEL = '경기 후속 정리';
const MATCH_FOLLOW_UP_SECTION_LABEL = '직전 경기 후속';

function localizeLoopRiskText(text: string): string {
  return text
    .replace('Budget pressure', '재정 압박')
    .replace('Room chemistry watch', '팀 케미스트리 점검')
    .replace('Room chemistry', '팀 케미스트리')
    .replace('Regional pressure check', '지역 기대 압박 점검')
    .replace('International broadcast desk', '국제 무대 압박 점검')
    .replace('Financial pressure is manageable.', '재정 압박은 아직 관리 가능한 수준입니다.')
    .replace('International pressure is forming, but the club still has room to build before it becomes a season-defining burden.', '국제 기대가 형성되고 있지만 아직은 시즌 전체를 짓누를 단계는 아닙니다.')
    .replace('Relationship signal is still shallow, but staff trust is sitting around', '관계 신호는 아직 옅지만 스태프 신뢰도는 현재')
    .replace('The board has already tied credibility to international-level delivery.', '보드는 이미 국제 무대 성과를 신뢰 기준으로 보기 시작했습니다.')
    .replace('The board is not fully demanding international success yet, but strong domestic seasons will raise that bar.', '보드가 아직 국제 성과를 강하게 요구하지는 않지만, 국내 성적이 쌓이면 기준은 더 높아집니다.')
    .trim();
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
  const title = maybeTitle ?? '운영 메모';
  const summary = maybeSummary ?? maybeTitle ?? '상세 내용을 확인해 주세요.';
  return {
    title,
    summary,
    route: getLoopRiskRoute(title, summary),
  };
}

function isMatchResultInboxMessage(message: { relatedId: string | null; title: string }): boolean {
  return message.relatedId?.startsWith('match_result:') || message.title.startsWith('[경기 결과]');
}

function getFirstSeasonRetentionChoice(params: {
  currentWeek: number;
  wins: number;
  losses: number;
  nextOpponentName?: string;
  topLoopRisk?: DisplayRiskItem | null;
  featuredInboxFollowUp?: FeaturedInboxFollowUp | null;
  playerInsight?: PlayerManagementInsight | null;
}): RetentionStoryChoice {
  const { currentWeek, wins, losses, nextOpponentName, topLoopRisk, featuredInboxFollowUp, playerInsight } = params;

  if (featuredInboxFollowUp) {
    return {
      title: '직전 경기에서 시즌 서사 꺼내기',
      summary: '방금 끝난 경기의 여파를 바로 정리하면 이번 시즌의 첫 갈림길이 단순 결과가 아니라 팀 이야기로 남습니다.',
      route: featuredInboxFollowUp.actionRoute ?? '/manager/inbox',
      cta: '직전 경기 후속 이어가기',
    };
  }

  if (losses >= 2 && losses > wins) {
    return {
      title: '초반 반등 포인트 만들기',
      summary: '시즌 초반 연패 구간은 오래 남습니다. 다음 경기나 전술 조정에서 반등 포인트를 잡아야 이번 시즌의 톤이 바뀝니다.',
      route: '/manager/tactics',
      cta: '반등 플랜 잡기',
    };
  }

  if (playerInsight && playerInsight.overallSatisfaction <= 60) {
    return {
      title: '주전 분위기 먼저 지키기',
      summary: '첫 시즌에는 에이스나 핵심 주전의 분위기가 시즌 기억을 만듭니다. 지금 케어하면 성장 서사를 만들 여지가 큽니다.',
      route: '/manager/complaints',
      cta: '선수 상태 챙기기',
    };
  }

  if (topLoopRisk && (topLoopRisk.title.includes('보드') || topLoopRisk.title.includes('국제전'))) {
    return {
      title: '초반 기대치를 시즌 드라마로 바꾸기',
      summary: '보드와 외부 기대치가 높을수록 초반 선택 하나가 시즌 전체 평가로 이어집니다. 이번 흐름을 먼저 다듬어 두는 편이 좋습니다.',
      route: topLoopRisk.route,
      cta: '핵심 압박 먼저 정리하기',
    };
  }

  if (currentWeek <= 4) {
    return {
      title: `${nextOpponentName ?? '다음 상대'}전으로 첫 인상 만들기`,
      summary: '시즌 초반 4주는 팀 색을 각인시키는 구간입니다. 다음 상대전의 준비와 이야기만 잘 잡아도 첫 시즌 몰입감이 크게 올라갑니다.',
      route: nextOpponentName ? '/manager/pre-match' : '/manager/day',
      cta: '첫 시즌 흐름 만들기',
    };
  }

  return {
    title: '이번 시즌 대표 서사 키우기',
    summary: '지금은 체크리스트보다 시즌을 대표할 이야기를 하나 잡을 타이밍입니다. 라이벌전, 반등, 스타 성장 중 하나를 밀어주는 편이 좋습니다.',
    route: '/manager/news',
    cta: '이번 시즌 이야기 보기',
  };
}

export function ManagerHome() {
  useBgm('game');

  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const dayType = useGameStore((s) => s.dayType);
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
  const [featuredInboxFollowUp, setFeaturedInboxFollowUp] = useState<FeaturedInboxFollowUp | null>(null);

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
          inboxMessages,
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
          getInboxMessages(userTeam.id, 12, false).catch(() => []),
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
            .map((item) => ({
              title: localizeLoopRiskText(item.title),
              summary: localizeLoopRiskText(item.summary),
              route: item.route,
            }))
            .slice(0, 4),
        );
        setManagerIdentity(identity);
        setStaffFitSummary(fit);
        const latestMatchFollowUp = inboxMessages.find(isMatchResultInboxMessage) ?? null;
        setFeaturedInboxFollowUp(
          latestMatchFollowUp
            ? {
                title: latestMatchFollowUp.title,
                summary: latestMatchFollowUp.content,
                actionRoute: latestMatchFollowUp.actionRoute,
              }
            : null,
        );

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
  const isMatchPrepPriority = Boolean(nextMatch && (dayType === 'match_day' || nextMatch.matchDate === season?.currentDate));

  const openMatchPrep = (match: TeamMatch | undefined) => {
    if (!match) {
      navigate('/manager/day');
      return;
    }

    setPendingUserMatch(match);
    setDayPhase('banpick');
    resetSeries();
    setBoFormat(match.boFormat);
    setHardFearlessSeries(Boolean(match.hardFearlessSeries));
    setCurrentGameDraftRequired(true);
    setSeriesFearlessPool({ blue: [], red: [] });
    navigate('/manager/pre-match');
  };

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

  const legacyDynamicCta: Array<{ label: string; route: string; variant?: 'primary' | 'info' }> = dayType === 'match_day'
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
  void legacyDynamicCta;

  const loopActions: HomeLoopAction[] = isMatchPrepPriority
    ? [
        {
          label: '경기 준비 열기',
          onClick: () => openMatchPrep(nextMatch),
          variant: 'primary',
          detail: nextMatch ? `${nextOpponentName ?? '다음 상대'}전 준비 화면으로 바로 이어집니다.` : '현재 대기 중인 경기를 바로 준비합니다.',
        },
        {
          label: '전술 확인',
          onClick: () => navigate('/manager/tactics'),
          variant: 'info',
          detail: '밴픽 전에 운영 방향과 우선순위를 다시 맞춥니다.',
        },
        {
          label: '드래프트 보기',
          onClick: () => navigate('/manager/draft'),
          variant: 'info',
          detail: '추천 밴과 핵심 카드부터 먼저 확인합니다.',
        },
      ]
    : dayType === 'rest'
      ? [
          {
            label: '선수 상태 확인',
            onClick: () => navigate('/manager/roster'),
            variant: 'primary',
            detail: '휴식일에는 체력과 사기부터 확인하는 편이 안전합니다.',
          },
          {
            label: '이적 시장 확인',
            onClick: () => navigate('/manager/transfer'),
            variant: 'info',
            detail: '당장 급하지 않은 운영 이슈를 미리 정리합니다.',
          },
          {
            label: '뉴스 확인',
            onClick: () => navigate('/manager/news'),
            detail: '외부 반응과 구단 이슈를 빠르게 훑습니다.',
          },
        ]
      : [
          {
            label: '시즌 진행',
            onClick: () => navigate('/manager/day'),
            variant: 'primary',
            detail: '오늘 일정과 다음 경기 준비 흐름으로 이어집니다.',
          },
          {
            label: '경기 준비 확인',
            onClick: () => openMatchPrep(nextMatch),
            variant: 'info',
            detail: nextMatch ? `${nextOpponentName ?? '다음 상대'}전 준비 상황을 미리 점검합니다.` : '확정된 다음 경기 준비 화면으로 이어집니다.',
          },
          {
            label: '전술 보기',
            onClick: () => navigate('/manager/tactics'),
            variant: 'info',
            detail: '경기 전에 수정할 전술 메모를 먼저 확인합니다.',
          },
        ];

  const prioritizedLoopActions: HomeLoopAction[] = featuredInboxFollowUp
    ? [
        {
          label: MATCH_FOLLOW_UP_LABEL,
          onClick: () => navigate(featuredInboxFollowUp.actionRoute ?? '/manager/inbox'),
          variant: 'primary',
          detail: featuredInboxFollowUp.summary,
        },
        ...loopActions.slice(0, 2),
      ]
    : loopActions;

  const prioritizedCoreNotes = (
    featuredInboxFollowUp
      ? [{ title: MATCH_FOLLOW_UP_SECTION_LABEL, summary: featuredInboxFollowUp.summary, route: featuredInboxFollowUp.actionRoute ?? '/manager/inbox' }]
      : loopRisks[0]
        ? [{ title: loopRisks[0].title, summary: loopRisks[0].summary, route: loopRisks[0].route }]
        : []
  ).concat(
    coreNotes.map((alert, index) => ({
      title: index === 0 && loopRisks[0] ? loopRisks[0].title : index === 0 ? '우선 확인' : '운영 메모',
      summary: alert,
      route: index === 0 && loopRisks[0] ? loopRisks[0].route : alert.includes('뉴스') ? '/manager/news' : '/manager/day',
    })),
  ).slice(0, 3);

  const spotlightChoice: SpotlightChoice = featuredInboxFollowUp
    ? {
        title: '방금 경기 여론 따라가기',
        summary: '급한 후속 정리와 별개로 기사와 반응을 먼저 보면 이번 경기의 여운과 다음 드라마가 더 선명해집니다.',
        route: '/manager/news',
        cta: '기사와 반응 보기',
      }
    : nextMatch
      ? {
          title: `${nextOpponentName ?? '다음 상대'}전 미리보기`,
          summary: '효율적으로는 시즌 진행이 먼저지만, 상대 이야기를 먼저 보면 다음 경기 몰입감이 훨씬 좋아집니다.',
          route: '/manager/pre-match',
          cta: '경기 이야기 보기',
        }
      : {
          title: '오늘 팀 분위기 둘러보기',
          summary: '급한 일이 적은 날에는 뉴스와 메모를 훑으면서 지금 팀이 어떤 시즌 드라마를 만들고 있는지 보는 편이 더 재미있습니다.',
          route: '/manager/news',
          cta: '오늘 이야기 보기',
        };
  const retentionStoryChoice = getFirstSeasonRetentionChoice({
    currentWeek: season.currentWeek,
    wins,
    losses,
    nextOpponentName,
    topLoopRisk: loopRisks[0] ?? null,
    featuredInboxFollowUp,
    playerInsight: playerInsights[0] ?? null,
  });

  return (
    <div className="fm-animate-in">
      {!tutorialComplete ? <TutorialOverlay /> : null}

      <div className="fm-page-header">
        <h1 className="fm-page-title">팀 운영 허브</h1>
        <p className="fm-page-subtitle">오늘 처리할 운영 판단과 다음 이동만 한눈에 보이도록 정리했습니다.</p>
      </div>

      <div className="fm-grid fm-grid--3 fm-mb-lg" data-testid="managerhome-priority-strip">
        <button type="button" className="fm-card fm-text-left" onClick={featuredInboxFollowUp ? () => navigate(featuredInboxFollowUp.actionRoute ?? '/manager/inbox') : isMatchPrepPriority ? () => openMatchPrep(nextMatch) : () => navigate('/manager/day')}>
          <div className="fm-text-xs fm-text-muted fm-mb-xs">吏湲?????좎젅</div>
          <div className="fm-text-primary fm-font-semibold fm-mb-xs">{featuredInboxFollowUp ? MATCH_FOLLOW_UP_LABEL : isMatchPrepPriority ? '寃쎄린 以鍮??닿린' : '?쒖쫵 吏꾪뻾'}</div>
          <div className="fm-text-secondary">{featuredInboxFollowUp ? featuredInboxFollowUp.summary : nextMatch ? `${nextOpponentName ?? '?ㅼ쓬 ?곷?'} / ${nextMatch.matchDate}` : coreNotes[0]}</div>
        </button>
        <button type="button" className="fm-card fm-text-left" onClick={nextMatch ? () => openMatchPrep(nextMatch) : () => navigate('/manager/day')}>
          <div className="fm-text-xs fm-text-muted fm-mb-xs">?ㅼ쓬 寃쎄린</div>
          <div className="fm-text-primary fm-font-semibold fm-mb-xs">{nextOpponentName ?? '?쇱젙 ?놁쓬'}</div>
          <div className="fm-text-secondary">{nextMatch ? `${nextMatch.matchDate} / ${nextMatch.boFormat}` : '?뺤젙???ㅼ쓬 ?쇱젙???꾩쭅 ?놁뒿?덈떎.'}</div>
        </button>
        <button type="button" className="fm-card fm-text-left" onClick={() => navigate(loopRisks[0]?.route ?? '/manager/day')}>
          <div className="fm-text-xs fm-text-muted fm-mb-xs">媛???ы겕</div>
          <div className="fm-text-primary fm-font-semibold fm-mb-xs">{loopRisks[0]?.title ?? '?ъ젙 ?곹깭'}</div>
          <div className="fm-text-secondary">{loopRisks[0]?.summary ?? `Payroll ${formatAmount(budgetPressure?.totalPayroll ?? 0)} / cap ${formatAmount(budgetPressure?.salaryCap ?? 0)}`}</div>
        </button>
      </div>

      <MainLoopPanel
        eyebrow="매니저 루프"
        title="오늘 확인해야 할 일과 다음 경기 준비 흐름"
        subtitle={alerts[0] ?? '급한 경고가 없으면 다음 경기와 팀 컨디션을 먼저 확인하면 됩니다.'}
        insights={[
          {
            label: featuredInboxFollowUp ? MATCH_FOLLOW_UP_SECTION_LABEL : '다음 경기',
            value: featuredInboxFollowUp ? MATCH_FOLLOW_UP_LABEL : nextOpponentName ?? '일정 없음',
            detail: featuredInboxFollowUp
              ? featuredInboxFollowUp.title
              : nextMatch ? `${nextMatch.matchDate} / ${nextMatch.boFormat}` : '확정된 다음 일정이 아직 없습니다.',
            tone: featuredInboxFollowUp ? 'danger' : nextMatch ? 'accent' : 'neutral',
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
          ...(featuredInboxFollowUp
            ? [{ label: MATCH_FOLLOW_UP_LABEL, onClick: () => navigate(featuredInboxFollowUp.actionRoute ?? '/manager/inbox'), variant: 'primary' as const }]
            : [{ label: '시즌 진행', onClick: () => navigate('/manager/day'), variant: 'primary' as const }]),
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

      <div className="fm-grid fm-grid--4 fm-mb-lg">
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
            {prioritizedCoreNotes.map((item) => (
              <button key={`${item.title}-${item.summary}`} type="button" className="fm-card fm-text-left" onClick={() => navigate(item.route)}>
                <div className="fm-text-primary fm-font-semibold fm-mb-xs">{item.title}</div>
                <div className="fm-text-secondary">{item.summary}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="fm-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">지금 할 수 있는 액션</span></div>
          <div className="fm-panel__body fm-flex-col fm-gap-sm">
            {prioritizedLoopActions.map((cta) => (
              <button key={cta.label} type="button" className="fm-card fm-text-left" onClick={cta.onClick}>
                <div className={`fm-text-primary fm-font-semibold fm-mb-xs${cta.variant === 'primary' ? ' fm-text-accent' : ''}`}>{cta.label}</div>
                {cta.detail ? <div className="fm-text-secondary">{cta.detail}</div> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="fm-panel" data-testid="managerhome-spotlight-panel">
          <div className="fm-panel__header"><span className="fm-panel__title">오늘 가장 재밌는 선택</span></div>
          <div className="fm-panel__body">
            <button type="button" className="fm-card fm-text-left" onClick={() => navigate(spotlightChoice.route)}>
              <div className="fm-text-primary fm-font-semibold fm-mb-xs">{spotlightChoice.title}</div>
              <div className="fm-text-secondary fm-mb-sm">{spotlightChoice.summary}</div>
              <div className="fm-text-xs fm-text-accent">{spotlightChoice.cta}</div>
            </button>
          </div>
        </div>
      </div>

      <div className="fm-panel fm-mb-lg" data-testid="managerhome-retention-panel">
        <div className="fm-panel__header"><span className="fm-panel__title">첫 시즌 몰입 포인트</span></div>
        <div className="fm-panel__body">
          <button type="button" className="fm-card fm-text-left" onClick={() => navigate(retentionStoryChoice.route)}>
            <div className="fm-text-primary fm-font-semibold fm-mb-xs">{retentionStoryChoice.title}</div>
            <div className="fm-text-secondary fm-mb-sm">{retentionStoryChoice.summary}</div>
            <div className="fm-text-xs fm-text-accent">{retentionStoryChoice.cta}</div>
          </button>
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
                  <button key={index} type="button" className="fm-card fm-text-left" onClick={() => navigate(risk.route)}>
                    <strong className="fm-text-primary">{risk.title}</strong>
                    <p className="fm-text-secondary fm-mt-sm" style={{ marginBottom: 0 }}>{risk.summary}</p>
                  </button>
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
