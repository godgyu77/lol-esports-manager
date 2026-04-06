import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { useAutoSave } from '../../../hooks/useAutoSave';

const NAV_GROUPS = [
  {
    title: '홈',
    items: [
      { to: '/player', label: '대시보드', icon: 'H', end: true },
      { to: '/player/day', label: '시즌 진행', icon: '\u25B6' },
    ],
  },
  {
    title: '성장',
    items: [
      { to: '/player/training', label: '훈련', icon: 'TR' },
      { to: '/player/solorank', label: '솔로랭크', icon: 'SR' },
      { to: '/player/stats', label: '통계', icon: 'G' },
    ],
  },
  {
    title: '팀',
    items: [
      { to: '/player/relations', label: '팀원 관계', icon: 'RL' },
      { to: '/player/schedule', label: '일정', icon: 'S' },
      { to: '/player/contract', label: '계약', icon: 'CT' },
    ],
  },
  {
    title: '커리어',
    items: [
      { to: '/player/media', label: '미디어', icon: 'MD' },
      { to: '/player/career', label: '커리어', icon: 'CR' },
    ],
  },
];

export function PlayerDashboard() {
  const navigate = useNavigate();
  useAutoSave();

  return (
    <div className="fm-layout">
      {/* Sidebar */}
      <nav className="fm-sidebar" aria-label="주 메뉴">
        <div className="fm-sidebar__header">
          <div className="fm-sidebar__team-logo">PL</div>
          <div>
            <div className="fm-sidebar__team-name">선수 모드</div>
            <div className="fm-sidebar__team-sub">선수 커리어</div>
          </div>
        </div>

        <div className="fm-sidebar__nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="fm-nav-group">
              <span className="fm-nav-group__title">{group.title}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `fm-nav-item${isActive ? ' fm-nav-item--active' : ''}`
                  }
                >
                  <span className="fm-nav-item__icon">{item.icon}</span>
                  <span className="fm-nav-item__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="fm-sidebar__footer">
          <button
            className="fm-sidebar__footer-btn fm-sidebar__footer-btn--accent"
            onClick={() => navigate('/save-load')}
          >
            저장/불러오기
          </button>
          <button
            className="fm-sidebar__footer-btn"
            onClick={() => navigate('/')}
          >
            메인 메뉴
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="fm-main">
        <div className="fm-topbar">
          <div className="fm-topbar__section">
            <span className="fm-topbar__value--accent">선수 커리어 모드</span>
          </div>
          <div className="fm-topbar__mobile-actions">
            <button className="fm-btn fm-btn--sm fm-btn--ghost" onClick={() => navigate('/save-load')}>
              저장
            </button>
            <button className="fm-btn fm-btn--sm fm-btn--ghost" onClick={() => navigate('/')}>
              메뉴
            </button>
          </div>
          <div className="fm-topbar__spacer" />
        </div>
        <div className="fm-content">
          <ErrorBoundary inline navigateTo="/player" navigateLabel="대시보드로 돌아가기">
            <Outlet />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
