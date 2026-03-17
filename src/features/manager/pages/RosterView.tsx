import { useGameStore } from '../../../stores/gameStore';

export function RosterView() {
  const save = useGameStore((s) => s.save);
  const teams = useGameStore((s) => s.teams);

  const userTeam = teams.find((t) => t.id === save?.userTeamId);

  if (!userTeam) {
    return <p style={{ color: '#6a6a7a' }}>데이터를 불러오는 중...</p>;
  }

  const mainRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'main',
  );
  const subRoster = userTeam.roster.filter(
    (p) => (p as { division?: string }).division === 'sub',
  );

  const positionLabel: Record<string, string> = {
    top: '탑',
    jungle: '정글',
    mid: '미드',
    adc: '원딜',
    support: '서포터',
  };

  const positionOrder = ['top', 'jungle', 'mid', 'adc', 'support'];
  const sortByPosition = <T extends { position: string }>(arr: T[]) =>
    [...arr].sort((a, b) => positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position));

  const renderTable = (players: typeof userTeam.roster, title: string) => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        {title} ({players.length}명)
      </h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>포지션</th>
            <th style={styles.th}>이름</th>
            <th style={styles.th}>나이</th>
            <th style={styles.th}>OVR</th>
            <th style={styles.th}>기계</th>
            <th style={styles.th}>센스</th>
            <th style={styles.th}>팀워크</th>
            <th style={styles.th}>일관</th>
            <th style={styles.th}>라인</th>
            <th style={styles.th}>공격</th>
            <th style={styles.th}>멘탈</th>
            <th style={styles.th}>계약</th>
          </tr>
        </thead>
        <tbody>
          {sortByPosition(players).map((player) => {
            const avgOvr = Math.round(
              (player.stats.mechanical +
                player.stats.gameSense +
                player.stats.teamwork +
                player.stats.consistency +
                player.stats.laning +
                player.stats.aggression) /
                6,
            );
            return (
              <tr key={player.id} style={styles.tr}>
                <td style={styles.td}>
                  <span style={styles.posTag}>{positionLabel[player.position] ?? player.position}</span>
                </td>
                <td style={{ ...styles.td, ...styles.nameCell }}>{player.name}</td>
                <td style={styles.td}>{player.age}</td>
                <td style={{ ...styles.td, ...getOvrStyle(avgOvr) }}>{avgOvr}</td>
                <td style={styles.td}>{player.stats.mechanical}</td>
                <td style={styles.td}>{player.stats.gameSense}</td>
                <td style={styles.td}>{player.stats.teamwork}</td>
                <td style={styles.td}>{player.stats.consistency}</td>
                <td style={styles.td}>{player.stats.laning}</td>
                <td style={styles.td}>{player.stats.aggression}</td>
                <td style={styles.td}>{player.mental.mental}</td>
                <td style={styles.td}>{player.contract.contractEndSeason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h1 style={styles.title}>로스터 관리</h1>
      {renderTable(mainRoster, '1군')}
      {subRoster.length > 0 && renderTable(subRoster, '2군')}
    </div>
  );
}

function getOvrStyle(ovr: number): React.CSSProperties {
  if (ovr >= 90) return { color: '#ffd700', fontWeight: 700 };
  if (ovr >= 80) return { color: '#a0d0ff', fontWeight: 600 };
  if (ovr >= 70) return { color: '#90ee90', fontWeight: 500 };
  return { color: '#e0e0e0' };
}

const styles: Record<string, React.CSSProperties> = {
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f0e6d2',
    marginBottom: '24px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#c89b3c',
    marginBottom: '12px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    borderBottom: '1px solid #3a3a5c',
    color: '#6a6a7a',
    fontSize: '12px',
    fontWeight: 500,
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '8px 10px',
    color: '#c0c0d0',
  },
  nameCell: {
    fontWeight: 500,
    color: '#e0e0e0',
  },
  posTag: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#c89b3c',
    background: 'rgba(200,155,60,0.1)',
    padding: '2px 8px',
    borderRadius: '4px',
  },
};
