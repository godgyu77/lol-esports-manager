import { NavLink, Outlet } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
import { useAutoSave } from '../../../hooks/useAutoSave';

const NAV_ITEMS = [
  { to: '/manager', label: '대시보드', icon: '\u{1F3E0}', end: true },
  { to: '/manager/day', label: '시즌 진행', icon: '\u25B6', end: false },
  { to: '/manager/roster', label: '로스터', icon: '\u{1F465}', end: false },
  { to: '/manager/schedule', label: '일정', icon: '\u{1F4C5}', end: false },
  { to: '/manager/standings', label: '순위표', icon: '\u{1F3C6}', end: false },
  { to: '/manager/stats', label: '통계', icon: '\u{1F4CA}', end: false },
  { to: '/manager/draft', label: '밴픽', icon: '\u2694', end: false },
  { to: '/manager/match', label: '경기', icon: '\u{1F3AE}', end: false },
  { to: '/manager/transfer', label: '이적 시장', icon: '\u{1F4B1}', end: false },
  { to: '/manager/contract', label: '계약', icon: '\u{1F4DD}', end: false },
  { to: '/manager/finance', label: '재정', icon: '\u{1F4B0}', end: false },
  { to: '/manager/tournament', label: '국제대회', icon: '\u{1F30D}', end: false },
  { to: '/manager/news', label: '뉴스', icon: '\u{1F4F0}', end: false },
];

export function ManagerDashboard() {
  const navigate = useNavigate();
  useAutoSave();

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar} className="dashboard-sidebar" aria-label="주 메뉴">
        <h2 style={styles.sidebarTitle} className="sidebar-title">감독 모드</h2>
        <ul style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className="nav-item"
                style={({ isActive }) => ({
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                })}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="sidebar-label"> {item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
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
    background: '#0d0d1a',
    color: '#e0e0e0',
  },
  sidebar: {
    width: '220px',
    background: '#12122a',
    borderRight: '1px solid #2a2a4a',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#c89b3c',
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
    color: '#8a8a9a',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '4px',
    textDecoration: 'none',
    transition: 'all 0.2s',
  },
  navItemActive: {
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
  },
  backBtn: {
    padding: '10px',
    border: '1px solid #3a3a5c',
    borderRadius: '6px',
    background: 'transparent',
    color: '#6a6a7a',
    cursor: 'pointer',
    fontSize: '13px',
  },
  main: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },
};
