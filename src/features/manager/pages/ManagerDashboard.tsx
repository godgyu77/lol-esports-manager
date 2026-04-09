import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../../../components/CommandPalette';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { MobileBottomNav } from '../../../components/MobileBottomNav';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { useNavBadges } from '../../../hooks/useNavBadges';
import { useGameStore } from '../../../stores/gameStore';
import { useMatchStore } from '../../../stores/matchStore';
import { formatAmount } from '../../../utils/formatUtils';

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

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'home',
    title: '기본',
    defaultExpanded: true,
    items: [
      { to: '/manager', label: '대시보드', icon: 'H', end: true },
      { to: '/manager/day', label: '시즌 진행', icon: 'D' },
      { to: '/manager/inbox', label: '받은편지', icon: 'I' },
      { to: '/manager/news', label: '뉴스', icon: 'N' },
    ],
  },
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

function getSplitLabel(split?: string) {
  if (split === 'spring') return '스프링';
  if (split === 'summer') return '서머';
  return '-';
}

export function ManagerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const save = useGameStore((state) => state.save);
  const season = useGameStore((state) => state.season);
  const teams = useGameStore((state) => state.teams);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, group.defaultExpanded])),
  );

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

  useEffect(() => {
    if (matchActive && !location.pathname.startsWith('/manager/match')) {
      requestNavigationPause();
      navigate('/manager/match', { replace: true });
    }
  }, [location.pathname, matchActive, navigate, requestNavigationPause]);

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
          <button className="fm-sidebar__footer-btn fm-sidebar__footer-btn--accent" onClick={() => navigate('/manager/day')}>
            시즌 진행
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

          <button className="fm-btn fm-btn--primary fm-btn--sm fm-topbar__action" onClick={() => navigate('/manager/day')}>
            다음 일정
          </button>
        </div>

        <div className="fm-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>

        <MobileBottomNav
          items={[
            { to: '/manager', label: '홈', icon: 'H', end: true },
            { to: '/manager/day', label: '일정', icon: 'D' },
            { to: '/manager/roster', label: '팀', icon: 'R' },
            { to: '/manager/tactics', label: '전술', icon: 'T' },
            { to: '/manager/transfer', label: '이적', icon: '$' },
            { label: '더보기', icon: '+', onClick: () => setSidebarOpen(true) },
          ]}
        />
      </div>

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
    </div>
  );
}
