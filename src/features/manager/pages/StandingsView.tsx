import { useEffect, useState } from 'react';
import { getStandings } from '../../../db/queries';
import { useGameStore } from '../../../stores/gameStore';
import { MainLoopPanel } from '../components/MainLoopPanel';

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
  const userRow = sorted.find((row) => row.teamId === save?.userTeamId);
  const userRank = sorted.findIndex((row) => row.teamId === save?.userTeamId) + 1;

  return (
    <div className="fm-animate-in">
      <div className="fm-page-header">
        <h1 className="fm-page-title">리그 순위</h1>
      </div>

      <MainLoopPanel
        eyebrow="참고 화면"
        title="현재 순위와 우리 팀 위치를 먼저 읽는 순위표"
        subtitle="전체 표를 읽기 전에 현재 팀 순위와 승패 흐름을 먼저 파악할 수 있게 상단 요약을 추가했습니다."
        insights={[
          {
            label: '참가 팀',
            value: `${sorted.length}팀`,
            detail: '현재 시즌 집계 기준 순위표입니다.',
            tone: 'neutral',
          },
          {
            label: '우리 팀 순위',
            value: userRank > 0 ? `${userRank}위` : '미집계',
            detail: userRow ? `${userRow.wins}승 ${userRow.losses}패` : '아직 팀 순위가 집계되지 않았습니다.',
            tone: userRank > 0 && userRank <= 3 ? 'success' : userRank > 0 ? 'accent' : 'warning',
          },
          {
            label: '세트 득실',
            value: userRow ? `${userRow.setWins - userRow.setLosses >= 0 ? '+' : ''}${userRow.setWins - userRow.setLosses}` : '-',
            detail: userRow ? `${userRow.setWins}승 ${userRow.setLosses}패` : '세트 데이터 없음',
            tone: userRow && userRow.setWins - userRow.setLosses >= 0 ? 'success' : 'warning',
          },
          {
            label: '선두 팀',
            value: sorted[0] ? getTeamName(sorted[0].teamId) : '없음',
            detail: sorted[0] ? `${sorted[0].wins}승 ${sorted[0].losses}패` : '리그 결과가 아직 없습니다.',
            tone: 'accent',
          },
        ]}
        note="순위표는 경쟁 구도를 읽는 참고형 화면이라, 상단 요약 뒤에 전체 표를 읽는 흐름이 더 잘 맞습니다."
      />

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
