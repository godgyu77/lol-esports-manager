import { NavLink, Outlet } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useNavBadges } from '../../../hooks/useNavBadges';
import { useKeyboardShortcuts } from '../../../hooks/useKeyboardShortcuts';
import { useGameStore } from '../../../stores/gameStore';

const NAV_ITEMS = [
  { to: '/manager', label: '대시보드', icon: '\u{1F3E0}', end: true },
  { to: '/manager/day', label: '시즌 진행', icon: '\u25B6', end: false },
  { to: '/manager/roster', label: '로스터', icon: '\u{1F465}', end: false },
  { to: '/manager/schedule', label: '일정', icon: '\u{1F4C5}', end: false },
  { to: '/manager/calendar', label: '캘린더', icon: '\u{1F4C5}', end: false },
  { to: '/manager/standings', label: '순위표', icon: '\u{1F3C6}', end: false },
  { to: '/manager/awards', label: '어워드', icon: '\u{1F3C5}', end: false },
  { to: '/manager/stats', label: '통계', icon: '\u{1F4CA}', end: false },
  { to: '/manager/draft', label: '밴픽', icon: '\u2694', end: false },
  { to: '/manager/match', label: '경기', icon: '\u{1F3AE}', end: false },
  { to: '/manager/transfer', label: '이적 시장', icon: '\u{1F4B1}', end: false },
  { to: '/manager/contract', label: '계약', icon: '\u{1F4DD}', end: false },
  { to: '/manager/finance', label: '재정', icon: '\u{1F4B0}', end: false },
  { to: '/manager/tournament', label: '국제대회', icon: '\u{1F30D}', end: false },
  { to: '/manager/training', label: '훈련', icon: '\u{1F3CB}', end: false },
  { to: '/manager/tactics', label: '전술', icon: '\u2694\uFE0F', end: false },
  { to: '/manager/staff', label: '스태프', icon: '\u{1F464}', end: false },
  { to: '/manager/scouting', label: '스카우팅', icon: '\u{1F50D}', end: false },
  { to: '/manager/academy', label: '아카데미', icon: '\u{1F393}', end: false },
  { to: '/manager/news', label: '뉴스', icon: '\u{1F4F0}', end: false },
  { to: '/manager/complaints', label: '선수 관리', icon: '\u{1F4AC}', end: false },
  { to: '/manager/records', label: '기록실', icon: '\u{1F4DC}', end: false },
  { to: '/manager/facility', label: '시설', icon: '\u{1F3D7}', end: false },
  { to: '/manager/social', label: '커뮤니티', icon: '\u{1F4AC}', end: false },
  { to: '/manager/compare', label: '선수 비교', icon: '\u2696', end: false },
  { to: '/manager/promises', label: '약속 관리', icon: '\u{1F91D}', end: false },
  { to: '/manager/inbox', label: '편지함', icon: '\u{1F4EC}', end: false },
  { to: '/manager/board', label: '구단', icon: '\u{1F3E2}', end: false },
];

export function ManagerDashboard() {
  const navigate = useNavigate();
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  useAutoSave();
  useKeyboardShortcuts({
    onSave: () => navigate('/save-load'),
  });

  const badges = useNavBadges(
    save?.userTeamId ?? '',
    season?.id ?? 0,
  );

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar} className="dashboard-sidebar" aria-label="주 메뉴">
        <h2 style={styles.sidebarTitle} className="sidebar-title">감독 모드</h2>
        <ul style={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const badge = badges[item.to] ?? 0;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className="nav-item"
                  style={({ isActive }) => ({
                    ...styles.navItem,
                    ...(isActive ? styles.navItemActive : {}),
                    position: 'relative' as const,
                  })}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="sidebar-label"> {item.label}</span>
                  {badge > 0 && (
                    <span style={styles.badge}>
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
        <button style={styles.saveBtn} className="back-btn" onClick={() => navigate('/save-load')}>
          저장/불러오기
        </button>
        <button style={styles.backBtn} className="back-btn" onClick={() => navigate('/')}>
          메인 메뉴
        </button>
      </nav>

      <main style={styles.main} className="dashboard-main">
        <ErrorBoundary inline navigateTo="/manager" navigateLabel="대시보드로 돌아가기">
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  sidebar: {
    width: '220px',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: '24px',
  },
  nav: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    flex: 1,
  },
  navItem: {
    display: 'block',
    padding: '10px 12px',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '4px',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  navItemActive: {
    color: 'var(--accent)',
    background: 'rgba(200,155,60,0.1)',
  },
  badge: {
    position: 'absolute' as const,
    top: '4px',
    right: '4px',
    background: 'var(--danger)',
    color: 'white',
    fontSize: '10px',
    fontWeight: 700,
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  saveBtn: {
    padding: '10px',
    border: '1px solid rgba(200,155,60,0.4)',
    borderRadius: '6px',
    background: 'rgba(200,155,60,0.08)',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: '13px',
    marginBottom: '8px',
  },
  backBtn: {
    padding: '10px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: '13px',
  },
  main: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },
};
