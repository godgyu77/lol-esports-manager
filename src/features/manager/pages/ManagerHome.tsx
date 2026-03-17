import { useGameStore } from '../../../stores/gameStore';

export function ManagerHome() {
  const save = useGameStore((s) => s.save);
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  if (!userTeam || !season) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  // 1군 로스터 (division이 있으면 main 기준, 없으면 처음 5명)
  const mainRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const displayRoster = mainRoster.length > 0 ? mainRoster.slice(0, 5) : userTeam.roster.slice(0, 5);

  const positionLabel: Record<string, string> = {
    top: '탑',
    jungle: '정글',
    mid: '미드',
    adc: '원딜',
    support: '서포터',
  };

  return (
    <div>
      <h1 style={styles.title}>팀 대시보드</h1>

      {/* 팀 정보 카드 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>{userTeam.name}</h2>
        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>리전</span>
            <span style={styles.infoValue}>{userTeam.region}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>예산</span>
            <span style={styles.infoValue}>{(userTeam.budget / 10000).toFixed(1)}억</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>명성</span>
            <span style={styles.infoValue}>{userTeam.reputation}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>시즌</span>
            <span style={styles.infoValue}>
              {season.year} {season.split === 'spring' ? '스프링' : '서머'}
            </span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>주차</span>
            <span style={styles.infoValue}>{season.currentWeek}주차</span>
          </div>
        </div>
      </div>

      {/* 1군 로스터 요약 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>1군 로스터</h2>
        <div style={styles.rosterList}>
          {displayRoster.map((player) => {
            const avgStat = Math.round(
              (player.stats.mechanical +
                player.stats.gameSense +
                player.stats.teamwork +
                player.stats.consistency +
                player.stats.laning +
                player.stats.aggression) /
                6,
            );
            return (
              <div key={player.id} style={styles.rosterItem}>
                <span style={styles.rosterPos}>{positionLabel[player.position] ?? player.position}</span>
                <span style={styles.rosterName}>{player.name}</span>
                <span style={styles.rosterAge}>{player.age}세</span>
                <span style={styles.rosterOvr}>OVR {avgStat}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid #2a2a4a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '16px',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '16px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#6a6a7a',
  },
  infoValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  rosterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  rosterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
  },
  rosterPos: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#c89b3c',
    minWidth: '48px',
  },
  rosterName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 500,
    color: '#e0e0e0',
  },
  rosterAge: {
    fontSize: '12px',
    color: '#8a8a9a',
  },
  rosterOvr: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#a0d0ff',
    minWidth: '60px',
    textAlign: 'right',
  },
};
