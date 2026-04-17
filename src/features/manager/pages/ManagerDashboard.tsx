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
import { getLoopRiskRoute } from '../utils/loopRiskRouting';

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
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'club',
    title: '클럽',
    defaultExpanded: true,
    items: [
      { to: '/manager', label: '홈', icon: 'H', end: true },
      { to: '/manager/news', label: '뉴스', icon: 'N' },
      { to: '/manager/day', label: '진행', icon: 'D' },
      { to: '/manager/inbox', label: '인박스', icon: 'I' },
    ],
  },
  {
    id: 'team',
    title: '팀 관리',
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
    id: 'competition',
    title: '시즌',
    defaultExpanded: true,
    items: [
      { to: '/manager/schedule', label: '일정', icon: 'S' },
      { to: '/manager/calendar', label: '캘린더', icon: 'C' },
      { to: '/manager/standings', label: '순위', icon: 'L' },
      { to: '/manager/draft', label: '드래프트', icon: 'DR' },
      { to: '/manager/pre-match', label: '경기 준비', icon: 'PM' },
    ],
  },
  {
    id: 'business',
    title: '운영',
    defaultExpanded: true,
    items: [
      { to: '/manager/transfer', label: '이적시장', icon: 'FA' },
      { to: '/manager/finance', label: '재정', icon: '$' },
      { to: '/manager/facility', label: '시설', icon: 'F' },
      { to: '/manager/board', label: '보드', icon: 'B' },
    ],
  },
];

function getSplitLabel(split?: string) {
  if (split === 'spring') return '스프링';
  if (split === 'summer') return '서머';
  return '-';
}

function getDefaultNextRoute(dayType?: string | null) {
  if (dayType === 'match_day') return '/manager/pre-match';
  return '/manager/day';
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
  const nextRoute = featuredMatchFollowUp?.actionRoute
    ?? topLoopRisk?.route
    ?? getDefaultNextRoute(dayType);
  const nextReason = featuredMatchFollowUp?.summary
    ?? topLoopRisk?.summary
    ?? (dayType === 'match_day'
      ? '오늘 경기를 준비해야 합니다.'
      : '다음 일정으로 넘어가기 전에 필수 항목을 확인하세요.');
  const topbarAction = useMemo(() => ({
    to: nextRoute,
    label: '다음 진행',
  }), [nextRoute]);
  const priorityCards = useMemo(
    () => [
      {
        key: 'action',
        label: '오늘 할 일',
        value: featuredMatchFollowUp?.title ?? topLoopRisk?.title ?? (dayType === 'match_day' ? '경기 준비' : '시즌 진행'),
        detail: nextReason,
        to: nextRoute,
      },
      {
        key: 'news',
        label: '뉴스룸',
        value: featuredMatchFollowUp ? '후속 기사 확인' : '상황 브리핑 읽기',
        detail: featuredMatchFollowUp
          ? '방금 경기 후속 조치가 뉴스와 인박스에 정리되어 있습니다.'
          : '오늘 해야 할 일과 일반 뉴스를 한 화면에서 확인할 수 있습니다.',
        to: '/manager/news',
      },
      {
        key: 'status',
        label: '클럽 상태',
        value: userTeam ? formatAmount(userTeam.budget) : '팀 대기 중',
        detail: userTeam
          ? `${userTeam.name} 명성 ${userTeam.reputation}`
          : '예산과 팀 상태를 불러오는 중입니다.',
        to: topLoopRisk?.route ?? '/manager/finance',
      },
    ],
    [dayType, featuredMatchFollowUp, nextReason, nextRoute, topLoopRisk, userTeam],
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, group.defaultExpanded])),
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

      <nav className={`fm-sidebar${sidebarOpen ? ' fm-sidebar--open' : ''}`} aria-label="매니저 탐색">
        <div className="fm-sidebar__header">
          <div className="fm-sidebar__team-logo">{userTeam?.shortName?.slice(0, 2) ?? 'LM'}</div>
          <div className="fm-sidebar__header-copy">
            <div className="fm-sidebar__team-name">{userTeam?.name ?? '팀 대기 중'}</div>
            <div className="fm-sidebar__team-sub">매니저 허브</div>
            <div className="fm-sidebar__team-chip">
              {season ? `${season.year} ${getSplitLabel(season.split)} W${season.currentWeek}` : '시즌 대기'}
            </div>
          </div>
        </div>

        <div className="fm-sidebar__nav">
          {NAV_GROUPS.map((group) => (
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
            {priorityCards.map((card) => (
              <button key={card.key} type="button" className="fm-card fm-text-left" onClick={() => navigate(card.to)}>
                <div className="fm-text-xs fm-text-muted fm-mb-xs">{card.label}</div>
                <div className="fm-text-primary fm-font-semibold fm-mb-xs">{card.value}</div>
                <div className="fm-text-secondary">{card.detail}</div>
              </button>
            ))}
          </div>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>

        <MobileBottomNav
          items={[
            { to: '/manager', label: '홈', icon: 'H', end: true, badgeCount: badges['/manager'] ?? 0 },
            { to: '/manager/news', label: '뉴스', icon: 'N', badgeCount: badges['/manager/news'] ?? 0 },
            { to: nextRoute, label: 'Next', icon: '>' },
            { to: '/manager/roster', label: '로스터', icon: 'R', badgeCount: badges['/manager/roster'] ?? 0 },
            { label: '더보기', icon: '+', onClick: () => setSidebarOpen(true) },
          ]}
        />
      </div>

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
    </div>
  );
}
