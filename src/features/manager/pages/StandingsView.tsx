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
    return <p className="fm-text-muted fm-text-md">시즌 데이터를 불러오는 중...</p>;
  }

  if (isLoading) {
    return <p className="fm-text-muted fm-text-md">순위를 불러오는 중...</p>;
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
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">리그 순위</h1>
      </div>

      <div className="fm-panel">
        <div className="fm-panel__body--flush fm-table-wrap">
          <table className="fm-table fm-table--striped">
            <thead>
              <tr>
                <th>순위</th>
                <th>팀명</th>
                <th>승</th>
                <th>패</th>
                <th>세트 승</th>
                <th>세트 패</th>
                <th>세트 득실차</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const isUserTeam = row.teamId === save?.userTeamId;
                const setDiff = row.setWins - row.setLosses;
                return (
                  <tr
                    key={row.teamId}
                    className={isUserTeam ? 'fm-table__row--selected' : ''}
                  >
                    <td>{idx + 1}</td>
                    <td className={isUserTeam ? 'fm-cell--accent' : 'fm-cell--name'}>
                      {getTeamName(row.teamId)}
                    </td>
                    <td>{row.wins}</td>
                    <td>{row.losses}</td>
                    <td>{row.setWins}</td>
                    <td>{row.setLosses}</td>
                    <td className={setDiff > 0 ? 'fm-cell--green' : setDiff < 0 ? 'fm-cell--red' : ''}>
                      {setDiff > 0 ? `+${setDiff}` : setDiff}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
