import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../../../components/CommandPalette';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { MobileBottomNav } from '../../../components/MobileBottomNav';
import { getInboxMessages } from '../../../engine/inbox/inboxEngine';
import { getMainLoopRiskItems } from '../../../engine/manager/systemDepthEngine';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { useNavBadges } from '../../../hooks/useNavBadges';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import { formatAmount } from '../../../utils/formatUtils';
import { getLoopRiskActionLabel, getLoopRiskRoute } from '../utils/loopRiskRouting';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

interface NavGroup {
  id: string;
  title: string;
  defaultExpanded: boolean;
  items: NavItem[];
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
  tone?: 'risk' | 'neutral' | 'positive';
}

interface RetentionBanner {
  title: string;
  summary: string;
  route: string;
  cta: string;
}

const MATCH_FOLLOW_UP_LABEL = '경기 후속 정리';
const MATCH_SPOTLIGHT_LABEL = '방금 경기 여론 따라가기';
const PREVIEW_SPOTLIGHT_LABEL = '다음 상대전 미리보기';
const MOOD_SPOTLIGHT_LABEL = '오늘 팀 분위기 둘러보기';

const BASE_NAV_GROUPS: NavGroup[] = [
  {
    id: 'team',
    title: '팀 운영',
    defaultExpanded: true,
    items: [
      { to: '/manager/roster', label: '로스터', icon: 'R' },
      { to: '/manager/tactics', label: '전술', icon: 'T' },
      { to: '/manager/training', label: '훈련', icon: 'TR' },
      { to: '/manager/staff', label: '스태프', icon: 'ST' },
      { to: '/manager/complaints', label: '선수 관리', icon: 'P' },
    ],
  },
  {
    id: 'season',
    title: '시즌',
    defaultExpanded: true,
    items: [
      { to: '/manager/schedule', label: '일정', icon: 'S' },
      { to: '/manager/calendar', label: '캘린더', icon: 'C' },
      { to: '/manager/standings', label: '순위', icon: 'L' },
      { to: '/manager/patch-meta', label: '패치 메타', icon: 'M' },
    ],
  },
  {
    id: 'business',
    title: '구단 운영',
    defaultExpanded: true,
    items: [
      { to: '/manager/transfer', label: '이적 시장', icon: 'FA' },
      { to: '/manager/finance', label: '재정', icon: '$' },
      { to: '/manager/facility', label: '시설', icon: 'F' },
      { to: '/manager/board', label: '이사회', icon: 'B' },
    ],
  },
];

function getPriorityNavGroup(dayType?: string | null): NavGroup {
  if (dayType === 'match_day') {
    return {
      id: 'priority',
      title: '오늘 우선',
      defaultExpanded: true,
      items: [
        { to: '/manager', label: '대시보드', icon: 'H', end: true },
        { to: '/manager/pre-match', label: '경기 준비', icon: 'PM' },
        { to: '/manager/tactics', label: '전술 확인', icon: 'T' },
        { to: '/manager/draft', label: '드래프트', icon: 'D' },
      ],
    };
  }

  if (dayType === 'rest') {
    return {
      id: 'priority',
      title: '오늘 우선',
      defaultExpanded: true,
      items: [
        { to: '/manager', label: '대시보드', icon: 'H', end: true },
        { to: '/manager/roster', label: '선수 상태', icon: 'R' },
        { to: '/manager/transfer', label: '이적 시장', icon: 'FA' },
        { to: '/manager/news', label: '뉴스', icon: 'N' },
      ],
    };
  }

  return {
    id: 'priority',
    title: '오늘 우선',
    defaultExpanded: true,
    items: [
      { to: '/manager', label: '대시보드', icon: 'H', end: true },
      { to: '/manager/day', label: '시즌 진행', icon: 'D' },
      { to: '/manager/training', label: '훈련', icon: 'TR' },
      { to: '/manager/tactics', label: '전술', icon: 'T' },
    ],
  };
}

function getTopbarAction(dayType?: string | null, featuredMatchFollowUp?: MatchFollowUpSummary | null, topLoopRisk?: LoopRiskSummary | null): NavItem {
  if (featuredMatchFollowUp) {
    return { to: featuredMatchFollowUp.actionRoute ?? '/manager/inbox', label: MATCH_FOLLOW_UP_LABEL, icon: 'PM' };
  }

  if (topLoopRisk) {
    return { to: topLoopRisk.route, label: getLoopRiskActionLabel(topLoopRisk.title), icon: topLoopRisk.route === '/manager/finance' ? '$' : 'PM' };
  }

  if (dayType === 'match_day') {
    return { to: '/manager/pre-match', label: '경기 준비', icon: 'PM' };
  }

  if (dayType === 'rest') {
    return { to: '/manager/roster', label: '선수 상태', icon: 'R' };
  }

  return { to: '/manager/day', label: '다음 일정', icon: 'D' };
}

function getSpotlightAction(dayType?: string | null, featuredMatchFollowUp?: MatchFollowUpSummary | null, topLoopRisk?: LoopRiskSummary | null): NavItem {
  if (featuredMatchFollowUp) {
    return { to: '/manager/news', label: MATCH_SPOTLIGHT_LABEL, icon: 'N' };
  }

  if (topLoopRisk) {
    return { to: topLoopRisk.route, label: getLoopRiskActionLabel(topLoopRisk.title), icon: topLoopRisk.route === '/manager/finance' ? '$' : 'PM' };
  }

  if (dayType === 'match_day') {
    return { to: '/manager/pre-match', label: PREVIEW_SPOTLIGHT_LABEL, icon: 'PM' };
  }

  if (dayType === 'rest') {
    return { to: '/manager/news', label: MOOD_SPOTLIGHT_LABEL, icon: 'N' };
  }

  return { to: '/manager/pre-match', label: PREVIEW_SPOTLIGHT_LABEL, icon: 'PM' };
}

function getSplitLabel(split?: string) {
  if (split === 'spring') return '스프링';
  if (split === 'summer') return '서머';
  return '-';
}

function getRetentionBanner(params: {
  currentWeek?: number;
  featuredMatchFollowUp?: MatchFollowUpSummary | null;
  topLoopRisk?: LoopRiskSummary | null;
  dayType?: string | null;
}): RetentionBanner {
  const { currentWeek = 1, featuredMatchFollowUp, topLoopRisk, dayType } = params;

  if (featuredMatchFollowUp) {
    return {
      title: '직전 경기 여파를 다음 시즌 흐름으로 잇기',
      summary: '방금 경기의 후속 정리를 미루지 않으면 이번 시즌의 첫 서사가 더 또렷하게 남습니다.',
      route: featuredMatchFollowUp.actionRoute ?? '/manager/inbox',
      cta: '경기 후속 바로 정리',
    };
  }

  if (topLoopRisk && (topLoopRisk.title.includes('보드') || topLoopRisk.title.includes('국제전'))) {
    return {
      title: '초반 기대치를 시즌 드라마로 바꾸기',
      summary: topLoopRisk.summary,
      route: topLoopRisk.route,
      cta: getLoopRiskActionLabel(topLoopRisk.title),
    };
  }

  if (dayType === 'match_day') {
    return {
      title: '다음 경기로 시즌 첫 인상 만들기',
      summary: '시즌 초반 경기일수록 결과보다도 팀 색과 흐름을 만드는 장면이 오래 남습니다.',
      route: '/manager/pre-match',
      cta: '경기 이야기 만들기',
    };
  }

  if (currentWeek <= 4) {
    return {
      title: '첫 4주 안에 팀 색깔 잡기',
      summary: '지금은 체크리스트를 넘기는 시기보다 이번 시즌을 대표할 분위기와 선택을 쌓아두는 시기입니다.',
      route: '/manager/day',
      cta: '이번 주 흐름 만들기',
    };
  }

  return {
    title: '이번 시즌 대표 서사 키우기',
    summary: '라이벌전, 반등, 스타 성장 중 하나를 명확하게 밀어주면 시즌 후반 리텐션이 더 강해집니다.',
    route: '/manager/news',
    cta: '시즌 이야기 더 보기',
  };
}

export function ManagerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const save = useGameStore((state) => state.save);
  const season = useGameStore((state) => state.season);
  const teams = useGameStore((state) => state.teams);
  const dayType = useGameStore((state) => state.dayType);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [featuredMatchFollowUp, setFeaturedMatchFollowUp] = useState<MatchFollowUpSummary | null>(null);
  const [topLoopRisk, setTopLoopRisk] = useState<LoopRiskSummary | null>(null);

  const matchActive = useMatchStore((state) => state.matchActive);
  const requestNavigationPause = useMatchStore((state) => state.requestNavigationPause);

  useAutoSave();
  useKeyboardShortcuts({
    onSave: () => navigate('/save-load'),
  });

  const isImmersiveRoute =
    location.pathname.startsWith('/manager/match') ||
    location.pathname.startsWith('/manager/draft');
  const badges = useNavBadges(save?.userTeamId ?? '', season?.id ?? 0);
  const userTeam = teams.find((team) => team.id === save?.userTeamId);
  const navGroups = useMemo(() => [getPriorityNavGroup(dayType), ...BASE_NAV_GROUPS], [dayType]);
  const topbarAction = useMemo(() => getTopbarAction(dayType, featuredMatchFollowUp, topLoopRisk), [dayType, featuredMatchFollowUp, topLoopRisk]);
  const spotlightAction = useMemo(() => getSpotlightAction(dayType, featuredMatchFollowUp, topLoopRisk), [dayType, featuredMatchFollowUp, topLoopRisk]);
  const dashboardPriorityCards = useMemo(
    () => [
      {
        key: 'primary',
        label: '지금 할 일',
        value: topbarAction.label,
        detail: featuredMatchFollowUp?.summary ?? (topLoopRisk?.summary ?? '오늘 허브에서 가장 먼저 처리할 행동입니다.'),
        to: topbarAction.to,
      },
      {
        key: 'focus',
        label: '다음 포커스',
        value: spotlightAction.label,
        detail: featuredMatchFollowUp ? '경기 직후 흐름을 바로 이어갑니다.' : topLoopRisk ? '현재 가장 큰 압박이나 후속 흐름을 확인합니다.' : '핵심 화면으로 빠르게 이어집니다.',
        to: spotlightAction.to,
      },
      {
        key: 'risk',
        label: '가장 큰 리스크',
        value: topLoopRisk?.title ?? '현재 안정',
        detail: topLoopRisk?.summary ?? `${userTeam ? `${userTeam.name} 예산 ${formatAmount(userTeam.budget)}` : '팀 상태를 다시 확인해 주세요.'}`,
        to: topLoopRisk?.route ?? '/manager',
      },
    ],
    [featuredMatchFollowUp, spotlightAction, topLoopRisk, topbarAction, userTeam],
  );
  const retentionBanner = useMemo(
    () =>
      getRetentionBanner({
        currentWeek: season?.currentWeek,
        featuredMatchFollowUp,
        topLoopRisk,
        dayType,
      }),
    [dayType, featuredMatchFollowUp, season?.currentWeek, topLoopRisk],
  );
  const mobilePrimaryItem = useMemo(
    () =>
      featuredMatchFollowUp
        ? { to: featuredMatchFollowUp.actionRoute ?? '/manager/inbox', label: MATCH_FOLLOW_UP_LABEL, icon: 'PM' }
        : topLoopRisk
          ? { to: topLoopRisk.route, label: getLoopRiskActionLabel(topLoopRisk.title), icon: topLoopRisk.route === '/manager/finance' ? '$' : 'PM' }
        : dayType === 'match_day'
        ? { to: '/manager/pre-match', label: '준비', icon: 'PM' }
        : dayType === 'rest'
          ? { to: '/manager/roster', label: '상태', icon: 'R' }
          : { to: '/manager/day', label: '일정', icon: 'D' },
    [dayType, featuredMatchFollowUp, topLoopRisk],
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(navGroups.map((group) => [group.id, group.defaultExpanded])),
  );

  useEffect(() => {
    if (matchActive && !location.pathname.startsWith('/manager/match')) {
      requestNavigationPause();
      navigate('/manager/match', { replace: true });
    }
  }, [location.pathname, matchActive, navigate, requestNavigationPause]);

  useEffect(() => {
    if (!save?.userTeamId) return;

    let cancelled = false;
    const loadLatestMatchFollowUp = async () => {
      try {
        const inboxMessages = await getInboxMessages(save.userTeamId, 12, false).catch(() => []);
        if (cancelled) return;

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
      } catch {
        if (!cancelled) setFeaturedMatchFollowUp(null);
      }
    };

    void loadLatestMatchFollowUp();
    return () => {
      cancelled = true;
    };
  }, [save?.userTeamId]);

  useEffect(() => {
    if (!save?.userTeamId || !season?.id || !season.currentDate) return;

    let cancelled = false;
    const loadLoopRisk = async () => {
      try {
        const items = await getMainLoopRiskItems(save.userTeamId, season.id, season.currentDate, save.id).catch(() => []);
        if (cancelled) return;

        const first = items[0] ?? null;
        setTopLoopRisk(
          first
            ? {
                title: first.title,
                summary: first.summary,
                route: getLoopRiskRoute(first.title, first.summary),
                tone: first.tone,
              }
            : null,
        );
      } catch {
        if (!cancelled) setTopLoopRisk(null);
      }
    };

    void loadLoopRisk();
    return () => {
      cancelled = true;
    };
  }, [save?.id, save?.userTeamId, season?.currentDate, season?.id]);

  useEffect(() => {
    if (isImmersiveRoute) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isImmersiveRoute]);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  useEffect(() => {
    setExpandedGroups((prev) => {
      const nextEntries = navGroups.map((group) => [group.id, prev[group.id] ?? group.defaultExpanded]);
      return Object.fromEntries(nextEntries);
    });
  }, [navGroups]);

  if (isImmersiveRoute) {
    return (
      <div className="fm-layout fm-layout--match-focus">
        <div className="fm-main">
          <div className="fm-content fm-content--match-focus">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-layout">
      {sidebarOpen && <div className="fm-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <nav className={`fm-sidebar${sidebarOpen ? ' fm-sidebar--open' : ''}`} aria-label="매니저 내비게이션">
        <div className="fm-sidebar__header">
          <div className="fm-sidebar__team-logo">{userTeam?.shortName?.slice(0, 2) ?? 'LM'}</div>
          <div className="fm-sidebar__header-copy">
            <div className="fm-sidebar__team-name">{userTeam?.name ?? '내 팀'}</div>
            <div className="fm-sidebar__team-sub">감독 커리어</div>
            <div className="fm-sidebar__team-chip">
              {season ? `${season.year} ${getSplitLabel(season.split)} W${season.currentWeek}` : '시즌 대기'}
            </div>
          </div>
        </div>

        <div className="fm-sidebar__nav">
          {navGroups.map((group) => (
            <div key={group.id} className="fm-nav-group">
              <button
                type="button"
                className="fm-nav-group__title"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={expandedGroups[group.id] ? 'true' : 'false'}
              >
                <span>{group.title}</span>
                <span className={`fm-nav-group__chevron${expandedGroups[group.id] ? ' fm-nav-group__chevron--open' : ''}`}>
                  v
                </span>
              </button>

              <div className={`fm-nav-group__items${expandedGroups[group.id] ? ' fm-nav-group__items--open' : ''}`}>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `fm-nav-item${isActive ? ' fm-nav-item--active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="fm-nav-item__icon">{item.icon}</span>
                    <span className="fm-nav-item__label">{item.label}</span>
                    {(badges[item.to] ?? 0) > 0 && (
                      <span className="fm-nav-item__badge">
                        {(badges[item.to] ?? 0) > 9 ? '9+' : badges[item.to]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="fm-sidebar__footer">
          <button className="fm-sidebar__footer-btn fm-sidebar__footer-btn--accent" onClick={() => navigate(topbarAction.to)}>
            {topbarAction.label}
          </button>
          <button className="fm-sidebar__footer-btn" onClick={() => navigate(spotlightAction.to)}>
            {spotlightAction.label}
          </button>
          <button className="fm-sidebar__footer-btn" onClick={() => navigate('/save-load')}>
            저장 / 불러오기
          </button>
          <button className="fm-sidebar__footer-btn" onClick={() => navigate('/')}>
            메인 메뉴
          </button>
        </div>
      </nav>

      <div className="fm-main">
        <div className="fm-topbar">
          <button className="fm-sidebar-toggle" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="사이드바 열기">
            =
          </button>

          <div className="fm-topbar__summary">
            <div className="fm-topbar__section fm-topbar__section--compact">
              <span className="fm-topbar__label">시즌</span>
              <span className="fm-topbar__value">{season ? `${season.year} ${getSplitLabel(season.split)}` : '-'}</span>
            </div>
            <div className="fm-topbar__section fm-topbar__section--compact">
              <span className="fm-topbar__label">날짜</span>
              <span className="fm-topbar__value">{season?.currentDate ?? '-'}</span>
            </div>
            <div className="fm-topbar__section fm-topbar__section--compact">
              <span className="fm-topbar__label">주차</span>
              <span className="fm-topbar__value--accent">{season ? `W${season.currentWeek}` : '-'}</span>
            </div>
          </div>

          <div className="fm-topbar__spacer" />

          {userTeam && (
            <div className="fm-topbar__summary fm-topbar__summary--team">
              <div className="fm-topbar__section fm-topbar__section--compact">
                <span className="fm-topbar__label">예산</span>
                <span className="fm-topbar__value">{formatAmount(userTeam.budget)}</span>
              </div>
              <div className="fm-topbar__section fm-topbar__section--compact">
                <span className="fm-topbar__label">명성</span>
                <span className="fm-topbar__value--accent">{userTeam.reputation}</span>
              </div>
            </div>
          )}

          <button className="fm-btn fm-btn--primary fm-btn--sm fm-topbar__action" onClick={() => navigate(topbarAction.to)}>
            {topbarAction.label}
          </button>
        </div>

        <div className="fm-content">
          <div className="fm-grid fm-grid--3 fm-mb-lg" data-testid="managerdashboard-priority-strip">
            {dashboardPriorityCards.map((card) => (
              <button key={card.key} type="button" className="fm-card fm-text-left" onClick={() => navigate(card.to)}>
                <div className="fm-text-xs fm-text-muted fm-mb-xs">{card.label}</div>
                <div className="fm-text-primary fm-font-semibold fm-mb-xs">{card.value}</div>
                <div className="fm-text-secondary">{card.detail}</div>
              </button>
            ))}
          </div>
          <div className="fm-panel fm-mb-lg" data-testid="managerdashboard-retention-panel">
            <div className="fm-panel__header"><span className="fm-panel__title">첫 시즌 몰입 포인트</span></div>
            <div className="fm-panel__body">
              <button type="button" className="fm-card fm-text-left" onClick={() => navigate(retentionBanner.route)}>
                <div className="fm-text-primary fm-font-semibold fm-mb-xs">{retentionBanner.title}</div>
                <div className="fm-text-secondary fm-mb-sm">{retentionBanner.summary}</div>
                <div className="fm-text-xs fm-text-accent">{retentionBanner.cta}</div>
              </button>
            </div>
          </div>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>

        <MobileBottomNav
          items={[
            { to: '/manager', label: '홈', icon: 'H', end: true, badgeCount: badges['/manager'] ?? 0 },
            { ...mobilePrimaryItem, badgeCount: mobilePrimaryItem.to ? badges[mobilePrimaryItem.to] ?? 0 : 0 },
            { to: '/manager/roster', label: '팀', icon: 'R', badgeCount: badges['/manager/roster'] ?? 0 },
            { to: '/manager/tactics', label: '전술', icon: 'T', badgeCount: badges['/manager/tactics'] ?? 0 },
            { to: '/manager/transfer', label: '이적', icon: '$', badgeCount: badges['/manager/transfer'] ?? 0 },
            { label: '더보기', icon: '+', onClick: () => setSidebarOpen(true) },
          ]}
        />
      </div>

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
    </div>
  );
}
