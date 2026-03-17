import { useEffect, useState } from 'react';
import { getStandings } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';

interface Standing {
  teamId: string;
  wins: number;
  losses: number;
  setWins: number;
  setLosses: number;
}

export function StandingsView() {
  const season = useGameStore((s) => s.season);
  const teams = useGameStore((s) => s.teams);
  const save = useGameStore((s) => s.save);

  const [standings, setStandings] = useState<Standing[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!season) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const data = await getStandings(season.id);
      if (!cancelled) {
        setStandings(data);
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [season]);

  if (!season) {
    return <p style={{ color: '#6a6a7a' }}>시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p style={{ color: '#6a6a7a' }}>순위를 불러오는 중...</p>;
  }

  const sorted = [...standings].sort((a, b) => {
    const winDiff = b.wins - a.wins;
    if (winDiff !== 0) return winDiff;
    const lossDiff = a.losses - b.losses;
    if (lossDiff !== 0) return lossDiff;
    return (b.setWins - b.setLosses) - (a.setWins - a.setLosses);
  });

  const getTeamName = (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    return team?.name ?? teamId;
  };

  return (
    <div>
      <h1 style={styles.title}>리그 순위</h1>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>순위</th>
            <th style={styles.th}>팀명</th>
            <th style={styles.th}>승</th>
            <th style={styles.th}>패</th>
            <th style={styles.th}>세트 승</th>
            <th style={styles.th}>세트 패</th>
            <th style={styles.th}>세트 득실차</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, idx) => {
            const isUserTeam = row.teamId === save?.userTeamId;
            const setDiff = row.setWins - row.setLosses;
            return (
              <tr
                key={row.teamId}
                style={{
                  ...styles.tr,
                  ...(isUserTeam ? styles.userRow : {}),
                }}
              >
                <td style={styles.td}>{idx + 1}</td>
                <td style={{
                  ...styles.td,
                  ...styles.nameCell,
                  ...(isUserTeam ? styles.userName : {}),
                }}>
                  {getTeamName(row.teamId)}
                </td>
                <td style={styles.td}>{row.wins}</td>
                <td style={styles.td}>{row.losses}</td>
                <td style={styles.td}>{row.setWins}</td>
                <td style={styles.td}>{row.setLosses}</td>
                <td style={{
                  ...styles.td,
                  color: setDiff > 0 ? '#90ee90' : setDiff < 0 ? '#ff6b6b' : '#c0c0d0',
                }}>
                  {setDiff > 0 ? `+${setDiff}` : setDiff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  userRow: {
    background: 'rgba(200,155,60,0.1)',
    borderBottom: '1px solid rgba(200,155,60,0.2)',
  },
  userName: {
    color: '#c89b3c',
    fontWeight: 700,
  },
};
