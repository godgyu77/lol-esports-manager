import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../../../components/CommandPalette';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { useNavBadges } from '../../../hooks/useNavBadges';
import { useGameStore } from '../../../stores/gameStore';
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
    title: '홈',
    defaultExpanded: true,
    items: [
      { to: '/manager', label: '대시보드', icon: 'H', end: true },
      { to: '/manager/day', label: '시즌 진행', icon: 'D' },
      { to: '/manager/inbox', label: '인박스', icon: 'I' },
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
      { to: '/manager/complaints', label: '선수 관리', icon: 'PC' },
    ],
  },
  {
    id: 'season',
    title: '시즌',
    defaultExpanded: true,
    items: [
      { to: '/manager/schedule', label: '일정', icon: 'S' },
      { to: '/manager/calendar', label: '캘린더', icon: 'C' },
      { to: '/manager/standings', label: '순위', icon: '#' },
      { to: '/manager/patch-meta', label: '패치 메타', icon: 'PM' },
    ],
  },
  {
    id: 'business',
    title: '구단',
    defaultExpanded: true,
    items: [
      { to: '/manager/transfer', label: '이적 시장', icon: 'TF' },
      { to: '/manager/finance', label: '재정', icon: 'W' },
      { to: '/manager/facility', label: '시설', icon: 'FC' },
      { to: '/manager/board', label: '이사회', icon: 'BD' },
    ],
  },
];

export function ManagerDashboard() {
  const navigate = useNavigate();
  const save = useGameStore((state) => state.save);
  const season = useGameStore((state) => state.season);
  const teams = useGameStore((state) => state.teams);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map((group) => [group.id, group.defaultExpanded])),
  );

  useAutoSave();
  useKeyboardShortcuts({
    onSave: () => navigate('/save-load'),
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const badges = useNavBadges(save?.userTeamId ?? '', season?.id ?? 0);
  const userTeam = teams.find((team) => team.id === save?.userTeamId);
  const seasonLabel = season ? `${season.year} ${season.split === 'spring' ? 'Spring' : 'Summer'}` : '-';
  const dateLabel = season?.currentDate ?? '-';
  const weekLabel = season ? `W${season.currentWeek}` : '-';

  return (
    <div className="fm-layout">
      {sidebarOpen && <div className="fm-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <nav className={`fm-sidebar${sidebarOpen ? ' fm-sidebar--open' : ''}`} aria-label="Manager navigation">
        <div className="fm-sidebar__header">
          <div className="fm-sidebar__team-logo">{userTeam?.shortName?.slice(0, 2) ?? 'LM'}</div>
          <div>
            <div className="fm-sidebar__team-name">{userTeam?.name ?? 'My Team'}</div>
            <div className="fm-sidebar__team-sub">감독 겸 단장</div>
          </div>
        </div>

        <div className="fm-sidebar__focus">
          <span className="fm-sidebar__focus-label">이번 주 포인트</span>
          <p className="fm-sidebar__focus-text">
            시즌 진행은 날짜만 넘기고, 훈련과 휴식은 주간 설정이 자동 적용됩니다.
          </p>
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
          <button className="fm-sidebar-toggle" onClick={() => setSidebarOpen((prev) => !prev)} aria-label="Toggle sidebar">
            =
          </button>
          <div className="fm-topbar__section">
            <span className="fm-topbar__label">시즌</span>
            <span className="fm-topbar__value">{seasonLabel}</span>
          </div>
          <div className="fm-topbar__divider" />
          <div className="fm-topbar__section">
            <span className="fm-topbar__label">날짜</span>
            <span className="fm-topbar__value">{dateLabel}</span>
          </div>
          <div className="fm-topbar__divider" />
          <div className="fm-topbar__section">
            <span className="fm-topbar__value--accent">{weekLabel}</span>
          </div>
          {userTeam && (
            <>
              <div className="fm-topbar__divider" />
              <div className="fm-topbar__section">
                <span className="fm-topbar__label">예산</span>
                <span className="fm-topbar__value">{formatAmount(userTeam.budget)}</span>
              </div>
              <div className="fm-topbar__divider" />
              <div className="fm-topbar__section">
                <span className="fm-topbar__label">명성</span>
                <span className="fm-topbar__value--accent">{userTeam.reputation}</span>
              </div>
            </>
          )}
          <button className="fm-topbar__action" onClick={() => navigate('/manager/day')}>
            다음 일정
          </button>
        </div>

        <div className="fm-content">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>

      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
    </div>
  );
}
