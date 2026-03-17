import { useNavigate } from 'react-router-dom';

export function PlayerDashboard() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <nav style={styles.sidebar}>
        <h2 style={styles.sidebarTitle}>선수 모드</h2>
        <ul style={styles.nav}>
          <li style={styles.navItem}>대시보드</li>
          <li style={styles.navItem}>일과 관리</li>
          <li style={styles.navItem}>훈련</li>
          <li style={styles.navItem}>경기 일정</li>
          <li style={styles.navItem}>면담 요청</li>
          <li style={styles.navItem}>팀원 관계</li>
          <li style={styles.navItem}>스트리밍</li>
        </ul>
        <button style={styles.backBtn} onClick={() => navigate('/')}>
          메인 메뉴
        </button>
      </nav>

      <main style={styles.main}>
        <h1 style={styles.title}>선수 대시보드</h1>
        <p style={styles.placeholder}>선수 모드 컨텐츠가 여기에 표시됩니다.</p>
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
    padding: '10px 12px',
    fontSize: '14px',
    color: '#8a8a9a',
    borderRadius: '6px',
    cursor: 'pointer',
    marginBottom: '4px',
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
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '16px',
  },
  placeholder: {
    color: '#6a6a7a',
  },
};
