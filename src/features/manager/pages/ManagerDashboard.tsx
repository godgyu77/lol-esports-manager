import { NavLink, Outlet } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/manager', label: '대시보드', end: true },
  { to: '/manager/roster', label: '로스터', end: false },
  { to: '/manager/schedule', label: '일정', end: false },
  { to: '/manager/transfer', label: '이적 시장', end: false },
  { to: '/manager/draft', label: '밴픽', end: false },
  { to: '/manager/match', label: '경기', end: false },
  { to: '/manager/finance', label: '재정', end: false },
];

export function ManagerDashboard() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>감독 모드</h2>
        <ul style={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                })}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <button style={styles.backBtn} onClick={() => navigate('/')}>
          메인 메뉴
        </button>
      </nav>

      <main style={styles.main}>
        <Outlet />
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
